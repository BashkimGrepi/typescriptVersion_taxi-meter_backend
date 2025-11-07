import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  CreateDriverDto, 
  UpdateDriverDto, 
  DriversQueryDto, 
  DriverResponseDto, 
  DriversPageResponse,
  DriverStatus 
} from '../dto/driver-admin.dto';
import { REQUEST } from '@nestjs/core';
import { request } from 'express';
import { TenantScopedService } from 'src/common/services/tenant-scoped.service';

@Injectable()
export class AdminDriverService extends TenantScopedService {
  constructor(
    @Inject(REQUEST) request: Express.Request,
    @Inject(PrismaService) private prisma: PrismaService,
  ) {
    super(request);
  }

  async getDrivers(query: DriversQueryDto): Promise<DriversPageResponse> {
    const tenantId = this.getCurrentTenantId();
    const { q, status, page = 1, pageSize = 25 } = query;
    
    const where = {
      tenantId,
      ...(status && status !== DriverStatus.ALL ? { status: status as any } : {}),
      ...(q ? {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' as any } },
          { lastName: { contains: q, mode: 'insensitive' as any } },
          { phone: { contains: q } },
        ],
      } : {}),
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
          userId: true,
          status: true,
        },
      }),
      this.prisma.driverProfile.count({ where }),
    ]);

    return {
      items: items.map(item => ({
        ...item,
        phone: item.phone || undefined,
        userId: item.userId || undefined,
        createdAt: new Date().toISOString(), // Placeholder since createdAt doesn't exist in schema
      })),
      total,
      page,
      pageSize,
    };
  }

  async createDriver(data: CreateDriverDto): Promise<DriverResponseDto> {
    const tenantId = this.getCurrentTenantId();
    const userId = this.getCurrentUserId();

    const driver = await this.prisma.driverProfile.create({
      data: {
        tenantId,
        userId,
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
        phone: true,
        userId: true,
        status: true,
      },
    });

    return {
      ...driver,
      phone: driver.phone || undefined,
      userId: driver.userId || undefined,
      createdAt: new Date().toISOString(),
    };
  }

  async updateDriver(
   
    driverId: string, 
    data: UpdateDriverDto
  ): Promise<DriverResponseDto> {
    const tenantId = this.getCurrentTenantId();
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
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.status && { status: data.status }),
      },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        phone: true,
        userId: true,
        status: true,
      },
    });

    return {
      ...updatedDriver,
      phone: updatedDriver.phone || undefined,
      userId: updatedDriver.userId || undefined,
      createdAt: new Date().toISOString(),
    };
  }
}