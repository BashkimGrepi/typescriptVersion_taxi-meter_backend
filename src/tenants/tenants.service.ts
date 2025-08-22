import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
