import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { DriverProfileResponseDto } from './dto/driver-profile-response.dto';
import { DriverInfo } from '../decorators/driver.decorator';

@Injectable()
export class DriverProfileService {
  constructor(private prisma: PrismaService) {}

  async getDriverProfile(driverInfo: DriverInfo): Promise<DriverProfileResponseDto> {
    // Fetch driver profile with tenant information
    const driverProfile = await (this.prisma as any).driverProfile.findUnique({
      where: { id: driverInfo.driverProfileId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            businessId: true
          }
        }
      }
    });

    if (!driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    // Additional security check - ensure the driver profile belongs to the authenticated user
    if (driverProfile.userId !== driverInfo.userId) {
      throw new ForbiddenException('Access denied to this driver profile');
    }

    return new DriverProfileResponseDto(driverProfile);
  }

  async updateDriverProfile(
    driverInfo: DriverInfo,
    updateData: UpdateDriverProfileDto
  ): Promise<DriverProfileResponseDto> {
    // First check if profile exists and belongs to user
    const existingProfile = await (this.prisma as any).driverProfile.findUnique({
      where: { id: driverInfo.driverProfileId }
    });

    if (!existingProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    if (existingProfile.userId !== driverInfo.userId) {
      throw new ForbiddenException('Access denied to this driver profile');
    }

    // Update only the allowed fields
    const updatedProfile = await (this.prisma as any).driverProfile.update({
      where: { id: driverInfo.driverProfileId },
      data: {
        // Only update fields that are provided and allowed
        ...(updateData.firstName !== undefined && { firstName: updateData.firstName }),
        ...(updateData.lastName !== undefined && { lastName: updateData.lastName }),
        ...(updateData.phone !== undefined && { phone: updateData.phone }),
        // Update timestamp is handled automatically by Prisma
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            businessId: true
          }
        }
      }
    });

    return new DriverProfileResponseDto(updatedProfile);
  }

  async validateDriverAccess(driverInfo: DriverInfo): Promise<boolean> {
    const driverProfile = await (this.prisma as any).driverProfile.findUnique({
      where: { 
        id: driverInfo.driverProfileId,
        userId: driverInfo.userId,
        status: 'ACTIVE' // Only allow active drivers
      }
    });

    return !!driverProfile;
  }
}
