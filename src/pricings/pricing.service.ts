import { PrismaService } from 'src/prisma/prisma.service';
import ListPricingPoliciesDto, {
  CreatePricingPolicyDto,
  UpdatePricingPolicyDto,
} from './dto/pricing-policies.dto';
import { Prisma, RidePricingMode } from '@prisma/client';
import { ignoreElements, NotFoundError } from 'rxjs';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { basename } from 'path';
import {
  CreateFixedPricePolicyDto,
  FixedPricePolicyResponseDto,
  ListFixedPricingPoliciesDto,
} from './dto/FixedPricePolicyDto';
import { AllPolicies } from './dto/AllPolicies';
import { AvailablePricingOptionsDto } from './dto/AvailablePricingOptions';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List pricing policies for the current tenant.
   * We pass tenantId explicitly to guarantee multi-tenant isolation at the data layer,
   * not just in controllers/guards.
   */
  async list(tenantId: string, dto: ListPricingPoliciesDto) {
    // Build WHERE dynamically but safely
    const where: Prisma.PricingPolicyWhereInput = { tenantId };

    if (dto.isActive !== undefined) {
      where.isActive = dto.isActive;
    }

    if (dto.search) {
      where.name = { contains: dto.search, mode: 'insensitive' };
    }

    // Build ORDER BY from a small, whitelisted set (see DTO)
    const orderBy: Prisma.PricingPolicyOrderByWithRelationInput = {
      [dto.orderBy]: dto.orderDir,
    } as any;

    /**
     * Use a transaction for a "consistent read":
     * - findMany (page)
     * - count (for total)
     * - count active (useful to know if an active policy exists)
     *
     * In Postgres, this gives you a stable snapshot within the same transaction.
     * Not strictly required, but avoids odd race conditions during pagination UIs.
     */
    const [items, total, activeCount] = await this.prisma.$transaction([
      this.prisma.pricingPolicy.findMany({
        where,
        orderBy,
        skip: dto.offset,
        take: dto.limit,
        select: {
          id: true,
          name: true,
          isActive: true,
          // baseFare/perKm are Decimal in Prisma; we return them as strings to avoid FP rounding bugs
          baseFare: true,
          perKm: true,
          perMin: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.pricingPolicy.count({ where }),
      this.prisma.pricingPolicy.count({ where: { tenantId, isActive: true } }),
    ]);

    // Serialize Decimal → string (recommended for money fields)
    const serialized = items.map((p) => ({
      ...p,
      baseFare: p.baseFare.toString(),
      perKm: p.perKm.toString(),
    }));

    return {
      items: serialized,
      total,
      activeCount, // helps UI warn if none is active
      page: Math.floor(dto.offset / dto.limit) + 1,
      pageSize: dto.limit,
    };
  }

  // ------------- CREATE Meter -------------
  async create(tenantId: string, dto: CreatePricingPolicyDto) {
    // if tenant has no active policy yet, we auto-activate the first one.
    const activeCount = await this.prisma.pricingPolicy.count({
      where: { tenantId, isActive: true },
    });
    const shouldActivate = dto.isActive === true || activeCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (shouldActivate) {
        //deactivate all others first for the tenant (idempodent)
        await tx.pricingPolicy.updateMany({
          where: { tenantId, isActive: true },
          data: { isActive: false },
        });
      }

      const created = await tx.pricingPolicy.create({
        data: {
          tenantId,
          name: dto.name,
          baseFare: dto.baseFare,
          perKm: dto.perKm,
          isActive: shouldActivate,
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          baseFare: true,
          perKm: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        ...created,
        baseFare: created.baseFare.toString(),
        perKm: created.perKm.toString(),
      };
    });
  }

  // ------------ UPDATE (no activation) -------------
  async update(tenantId: string, id: string, dto: UpdatePricingPolicyDto) {
    // verify ownership to prevents cross-tenant updates
    const existing = await this.prisma.pricingPolicy.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Pricing policy not found');

    const updated = await this.prisma.pricingPolicy.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        baseFare: dto.baseFare ?? undefined,
        perKm: dto.perKm ?? undefined,
        // isActive not included
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        baseFare: true,
        perKm: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...updated,
      baseFare: updated.baseFare.toString(),
      perKm: updated.perKm.toString(),
    };
  }

  // ------------ ACTIVATE (exactly one active per tenant) -------------
  async activate(tenantId: string, id: string) {
    // ensure the target policy belongs to the tenant
    const target = await this.prisma.pricingPolicy.findFirst({
      where: { id, tenantId },
      select: { id: true, isActive: true },
    });
    if (!target) throw new NotFoundException('Pricing policy not found');

    // if already active just return success (idempotent)
    if (target.isActive) return { id, isActive: true };

    await this.prisma.$transaction([
      this.prisma.pricingPolicy.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.pricingPolicy.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);
    return { id, isActive: true };
  }
  // (optional helper) get currently active for a tenant
  async getActive(tenantId: string) {
    const active = await this.prisma.pricingPolicy.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!active) return null;
    return {
      ...active,
      baseFare: active.baseFare.toString(),
      perKm: active.perKm.toString(),
    };
  }

  // create a fixed pricing policy by admin or manager
  async createFixedByAdmin(
    tenantId: string,
    dto: CreateFixedPricePolicyDto,
  ): Promise<FixedPricePolicyResponseDto> {
    const created = await this.prisma.fixedPricePolicy.create({
      data: {
        tenantId,
        name: dto.name,
        amount: dto.amount,
        createdAt: new Date(),
      },
      include: {
        tenant: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      tenantName: created.tenant.name,
      name: created.name,
      amount: created.amount.toString(),
      createdAt: created.createdAt.toISOString(),
    };
  }

  // list fixed pricing policies for the current tenant.
  // return the polices and count
  async listFixedPolicies(
    tenantId: string,
    userId: string,
  ): Promise<FixedPricePolicyResponseDto[]> {
    const items = await this.prisma.fixedPricePolicy.findMany({
      where: {
        tenantId: tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        tenant: {
          select: {
            name: true,
          },
        },
        name: true,
        amount: true,
        createdAt: true,
      },
    });
    return items.map((item) => ({
      id: item.id,
      tenantId,
      tenantName: item.tenant.name,
      name: item.name,
      amount: item.amount.toString(),
      createdAt: item.createdAt.toISOString(),
    }));
  }

  // create custom (own) fixed pricing policy for the spesific driver
  // needs more planning

  //async createCustomFixedByDriver(tenantId: string, )

  // list all pricing policies for the tenant (admin, manager)
  async listAllPolicies(args: {
    tenantId: string;
    userId: string;
    userRole: string;
  }): Promise<AllPolicies> {
    // securite layers: 1
    if (!["ADMIN", "MANAGER", "DRIVER"].includes(args.userRole)) {
      throw new ForbiddenException('Access denied');
    }

    // securite layers: 2
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: args.tenantId },
      select: { id: true, name: true, businessId: true, deletedAt: true },
    })

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    // secuirite layers: 3
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: args.userId,
        tenantId: args.tenantId,
        role: {
          in: ["ADMIN", "MANAGER", "DRIVER"]
        }
      }
    });
      
    if (!membership) {
      throw new ForbiddenException('No membership for this tenant');
    }
 

    const meterPoliciesData = await this.prisma.pricingPolicy.findMany({
      where: { tenantId: args.tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        baseFare: true,
        perKm: true,
        perMin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            name: true,
            businessId: true,
          },
        },
      },
    });

    const fixedPricePoliciesData = await this.prisma.fixedPricePolicy.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        amount: true,
        createdAt: true,
        tenant: {
          select: {
            name: true,
            businessId: true,
          },
        },
      },
    });

    return {
      meterPolicies: meterPoliciesData.map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        name: p.name,
        perKm: p.perKm.toString(),
        perMin: p.perMin.toString(),
        baseFare: p.baseFare.toString(),
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        tenant: {
          tenantName: p.tenant.name,
          businessId: p.tenant.businessId,
        },
      })),
      fixedPricePolicies: fixedPricePoliciesData.map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        name: p.name,
        amount: p.amount.toString(),
        createdAt: p.createdAt.toISOString(),
        tenant: {
          tenantName: p.tenant.name,
          businessId: p.tenant.businessId,
        },
      })),
      customFixedPricePolicies: {
        id: 'custom',
        amount: '5-999',
        createdAt: 'Anytime',
      },
    };
  }

  async listAvailablePoliciesForRide(args: {
    tenantId: string;
    userId: string;
    userRole: string;
    driverProfileId: string;
  }): Promise<AvailablePricingOptionsDto> {

    // securite layers: 1
    if (args.userRole !== "DRIVER") {
      throw new ForbiddenException('Access denied');
    }

    // securite layers: 2
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: args.tenantId },
      select: { id: true, name: true, businessId: true, deletedAt: true },
    })

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant not found');
    }

    // secuirite layers: 3
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: args.userId,
        tenantId: args.tenantId,
        role: "DRIVER"
      }
    });

    if (!membership) {
      throw new ForbiddenException('No membership for this tenant');
    }

    const activeMeterPolicy = await this.prisma.pricingPolicy.findFirst({
      where: { tenantId: args.tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        isActive: true,
        baseFare: true,
        perKm: true,
        perMin: true,
        tenant: {
          select: {
            id: true,
            name: true,
            businessId: true,
          }
        }
      },
    });

    if (!activeMeterPolicy) {
      throw new NotFoundException('No active meter pricing policy found');
    }

    const fixedPricePoliciesData = await this.prisma.fixedPricePolicy.findMany({
      where: { tenantId: args.tenantId },
      select: {
        id: true,
        name: true,
        amount: true,
        tenant: {
          select: {
            id: true,
            name: true,
            businessId: true,
          }
        }
        // description // needs to be added in the model
      },
    });

    if (!fixedPricePoliciesData) {
      throw new NotFoundException('No fixed price policies found');
    }

    const customFixedOption = {
      minAmount: '5.00',
      maxAmount: '999.99',
      description: 'Set your own fare amount',
    }

    return {
      meterPolicy: {
        id: activeMeterPolicy.id,
        name: activeMeterPolicy.name,
        isActive: activeMeterPolicy.isActive,
        baseFare: activeMeterPolicy.baseFare.toString(),
        perKm: activeMeterPolicy.perKm.toString(),
        perMin: activeMeterPolicy.perMin.toString(),
        mode: RidePricingMode.METER,
        tenant: {
          id: activeMeterPolicy.tenant.id,
          name: activeMeterPolicy.tenant.name,
          businessId: activeMeterPolicy.tenant.businessId,
        }
      },
      fixedPricePolicies: fixedPricePoliciesData.map((fp) => ({
        id: fp.id,
        name: fp.name,
        amount: fp.amount.toString(),
        mode: RidePricingMode.FIXED_PRICE,
        tenant: {
          id: fp.tenant.id,
          name: fp.tenant.name,
          businessId: fp.tenant.businessId,
        }
      })),
      customFixedOption: {
        minAmount: customFixedOption.minAmount,
        maxAmount: customFixedOption.maxAmount,
        description: customFixedOption.description,
        mode: RidePricingMode.CUSTOM_FIXED,
      }
    }
  }
}

