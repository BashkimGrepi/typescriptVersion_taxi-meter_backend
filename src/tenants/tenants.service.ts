import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSelectionDto, TenantSelectionsDto } from './dto/tenantsDto';

export interface TenantInfo {
  id: string;
  name: string;
  businessId: string;
}

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async getTenantById(tenantId: string): Promise<TenantInfo> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, businessId: true, deletedAt: true },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      businessId: tenant.businessId,
    };
  }

  async getTenantsForUser(userId: string): Promise<TenantSelectionsDto> {
    // Get user with their tenant memberships (active tenants only)
    const userWithTenants = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        memberships: {
          where: {
            // Only include active tenant memberships (tenant not deleted)
            tenant: { deletedAt: null },
          },
          select: {
            tenantId: true,
            tenant: {
              select: {
                id: true,
                name: true,
                businessId: true,
              },
            },
          },
        },
      },
    });

    if (!userWithTenants) {
      throw new NotFoundException('User not found');
    }

    // Transform the data to match our DTO structure
    const tenants: TenantSelectionDto[] = userWithTenants.memberships.map(
      (membership) => ({
        tenantId: membership.tenant.id,
        name: membership.tenant.name,
        businessId: membership.tenant.businessId,
      }),
    );

    return {
      tenants,
    };
  }

  async getDefaultTenantForUser(
    userId: string,
  ): Promise<TenantSelectionDto | null> {
    // Helper method to get the first available tenant for a user
    // Useful for single-tenant scenarios or default tenant selection
    const tenantsData = await this.getTenantsForUser(userId);

    // Return the first tenant, or null if user has no tenants
    return tenantsData.tenants.length > 0 ? tenantsData.tenants[0] : null;
  }
}
