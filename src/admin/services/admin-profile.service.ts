import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminOrManagerInfo } from "../../decorators/admin-or-manager.decorator";
import { AdminProfileResponseDto } from "../dto/admin-profile-response.dto";
import { REQUEST } from "@nestjs/core";
import { request } from "express";
import { TenantScopedService } from "src/common/services/tenant-scoped.service";


@Injectable()
export class AdminProfileService extends TenantScopedService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(REQUEST) request: Express.Request,
  ) {
    super(request);
  }
  async getAdminProfile(
    adminInfo: AdminOrManagerInfo,
  ): Promise<AdminProfileResponseDto> {
    // Step 1: Fetch user data
    const user = await this.prisma.user.findUnique({
      where: { id: adminInfo.userId },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Step 3: Calculate statistics
    // Promise.all used to run queries in parallel for efficiency
    const [driverCount, invitationCount] = await Promise.all([
      // count drivers in current tenant
      this.prisma.driverProfile.count({
        where: { tenantId: adminInfo.tenantId },
      }),
      // count invitations sent by this admin
      this.prisma.invitation.count({
        where: { invitedByUserId: adminInfo.userId },
      }),
    ]);
    const userRole = this.getCurrentUserRole();

    // Step 4: Build and return response
    const profileData = {
      id: user.id,
      email: user.email,
      status: user.status,
      accountCreatedAt: user.createdAt.toISOString(),
      tenantId: adminInfo.tenantId,
      role: userRole,
      stats: {
        totalDriversManaged: driverCount,
        totalInvitationsSent: invitationCount,
        lastLogin: undefined, // TODO: implement last login tracking
      },
    };
    return new AdminProfileResponseDto(profileData);
  }
}
