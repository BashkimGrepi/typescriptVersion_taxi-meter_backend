import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDriverDto,
  UpdateDriverDto,
  DriversQueryDto,
  DriverResponseDto,
  DriversPageResponse,
  DriverStatus,
} from '../dto/driver-admin.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminDriverService {
  constructor(private prisma: PrismaService) {}

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async getDrivers(
    tenantId: string,
    query: DriversQueryDto,
  ): Promise<DriversPageResponse> {
    const { q, status, page = 1, pageSize = 25 } = query;

    const where = {
      tenantId,
      ...(status && status !== DriverStatus.ALL
        ? { status: status as any }
        : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' as any } },
              { lastName: { contains: q, mode: 'insensitive' as any } },
              { phone: { contains: q } },
              { email: { contains: q, mode: 'insensitive' as any } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.driverProfile.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          userId: true,
          status: true,
        },
      }),
      this.prisma.driverProfile.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        email: item.email,
        phone: item.phone || '',
        userId: item.userId || '',
        createdAt: new Date().toISOString(), // Placeholder since createdAt doesn't exist in schema
      })),
      total,
      page,
      pageSize,
    };
  }

  async createDriver(
    tenantId: string,
    data: CreateDriverDto,
  ): Promise<DriverResponseDto> {
    // First create a User account for the driver
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await this.hashPassword('ChangeMe123!'), // Temporary password
        status: 'ACTIVE',
      },
    });

    // Create membership linking user to tenant as DRIVER
    await this.prisma.membership.create({
      data: {
        userId: user.id,
        tenantId,
        role: 'DRIVER',
      },
    });

    // Then create the driver profile
    const driver = await this.prisma.driverProfile.create({
      data: {
        userId: user.id,
        tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        status: 'INVITED', // Default status
      },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        userId: true,
        status: true,
      },
    });

    return {
      ...driver,
      email: driver.email,
      phone: driver.phone || '',
      userId: driver.userId || '',
      createdAt: new Date().toISOString(),
    };
  }

  async updateDriver(
    tenantId: string,
    driverId: string,
    data: UpdateDriverDto,
  ): Promise<DriverResponseDto> {
    // First check if driver exists and belongs to tenant
    const existingDriver = await this.prisma.driverProfile.findFirst({
      where: { id: driverId, tenantId },
    });

    if (!existingDriver) {
      throw new NotFoundException('Driver not found');
    }

    const updatedDriver = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.email && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.status && { status: data.status }),
      },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        userId: true,
        status: true,
      },
    });

    return {
      id: updatedDriver.id,
      tenantId: updatedDriver.tenantId,
      firstName: updatedDriver.firstName,
      lastName: updatedDriver.lastName,
      email: updatedDriver.email,
      phone: updatedDriver.phone || '',
      userId: updatedDriver.userId || '',
      status: updatedDriver.status,
      createdAt: new Date().toISOString(),
    };
  }
}
