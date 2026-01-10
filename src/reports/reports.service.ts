import { Inject, Injectable } from "@nestjs/common"
import { SummaryDto } from "./dto/summary.dto"
import { PrismaService } from "src/prisma/prisma.service"
import { Prisma, RideStatus } from "@prisma/client"
import { REQUEST } from "@nestjs/core";
import e, { request } from "express";
import { TenantScopedService } from "src/common/services/tenant-scoped.service";

@Injectable()
export class ReportsService extends TenantScopedService {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) request: Express.Request
  ) {
    super(request);
  }

  async getSummary(from: Date, to: Date): Promise<SummaryDto> {
    const tenantId = this.getCurrentTenantId();

    const completedWhere = { tenantId, status: RideStatus.COMPLETED, endedAt: { gte: from, lt: to } };
    const cancelledWhere = { tenantId, status: RideStatus.CANCELLED, endedAt: { gte: from, lt: to } };

    const [completed, cancelled, sums, distinctDrivers] = await this.prisma.$transaction([
      this.prisma.ride.count({ where: completedWhere }),
      this.prisma.ride.count({ where: cancelledWhere }),
      this.prisma.ride.aggregate({
        where: completedWhere,
        _sum: { fareSubtotal: true, taxAmount: true, fareTotal: true },
      }),
      this.prisma.ride.findMany({
        where: completedWhere,
        select: { driverProfileId: true },
        distinct: ['driverProfileId'],
      }),
    ]);

    const money = (d?: Prisma.Decimal | null) => (d ?? new Prisma.Decimal(0)).toDP(2).toString();

    return {
      tenantId,
      from: from.toISOString(),
      to: to.toISOString(),
      rides: {
        completed,
        cancelled,
        activeDrivers: distinctDrivers.length,
      },
      revenue: {
        subtotal: money(sums._sum.fareSubtotal),
        tax:      money(sums._sum.taxAmount),
        total:    money(sums._sum.fareTotal),
        currency: 'EUR',
      },
    };
  }
}
