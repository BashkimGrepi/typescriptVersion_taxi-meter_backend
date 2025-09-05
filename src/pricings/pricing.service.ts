
import { PrismaService } from "src/prisma/prisma.service";
import ListPricingPoliciesDto, { CreatePricingPolicyDto, UpdatePricingPolicyDto } from "./dto/pricing-policies.dto";
import { Prisma } from "@prisma/client";
import { NotFoundError } from "rxjs";
import { Injectable, NotFoundException } from "@nestjs/common";
import { basename } from "path";


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
      activeCount,                 // helps UI warn if none is active
      page: Math.floor(dto.offset / dto.limit) + 1,
      pageSize: dto.limit,
    };
  }

    // ------------- CREATE -------------
    async create(tenantId: string, dto: CreatePricingPolicyDto) {
        // if tenant has no active policy yet, we auto-activate the first one.
        const activeCount = await this.prisma.pricingPolicy.count({
            where: { tenantId, isActive: true },
        });
        const shouldActivate = dto.isActive === true || activeCount === 0;;

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
}