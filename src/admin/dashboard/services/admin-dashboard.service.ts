import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BussinessStatusResponse,
  DriverActivity,
  LiveOperations,
  PaymentSummaryResponse,
  PaymentSystemHealthResponse,
  PerformanceTrendsResponse,
  RevenueOverviewResponse,
} from '../dto/bussiness-status';
import { TenantScopedService } from 'src/common/services/tenant-scoped.service';
import { REQUEST } from '@nestjs/core';

@Injectable()
export class AdminDashboardService extends TenantScopedService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(REQUEST) request: Express.Request,
  ) {
    super(request);
  }

   async getDateRange(
    tenantId: string,
    period: 'all_time' | 'current_month' | 'today',
  ): Promise<{ fromDate: Date; toDate: Date }> {
    const toDate = new Date(); // now
    let fromDate: Date;

    switch (period) {
      case 'today':
        fromDate = new Date(new Date().setHours(0, 0, 0, 0));
        break;

      case 'current_month':
        const now = new Date();
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;

      case 'all_time':
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { createdAt: true },
        });
        if (!tenant) {
          throw new Error('Tenant not found');
        }

        fromDate = tenant.createdAt;
        break;
    }
    return { fromDate, toDate };
  }

  async getBussinessStatus(
    tenantId: string,
    query: { period: 'all_time' | 'current_month' | 'today' },
  ): Promise<BussinessStatusResponse> {
    const { fromDate, toDate } = await this.getDateRange(
      tenantId,
      query.period,
    );

    const ridesData = await this.prisma.ride.groupBy({
      by: ['status'],
      where: {
        tenantId,
        startedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _count: { _all: true },
    });

    // lated will implement health check

    //totals
    const totalRides = ridesData.reduce(
      (sum, group) => sum + group._count._all,
      0,
    );

    // individual staus count
    const statusCounts = {
      completed:
        ridesData.find((g) => g.status === 'COMPLETED')?._count._all || 0,
      cancelled:
        ridesData.find((g) => g.status === 'CANCELLED')?._count._all || 0,
      ongoing: ridesData.find((g) => g.status === 'ONGOING')?._count._all || 0,
    };

    return {
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      rides: {
        total: totalRides,
        completed: statusCounts.completed,
        cancelled: statusCounts.cancelled,
        ongoing: statusCounts.ongoing,
      },
      //health: {
      //    status: "200 OK"
      //}
    };
  }

  async getRevenueOverview(
    tenantId: string,
    query: { period: 'all_time' | 'current_month' | 'today' },
  ): Promise<RevenueOverviewResponse> {
    const { fromDate, toDate } = await this.getDateRange(
      tenantId,
      query.period,
    );

    const revenueData = await this.prisma.payment.aggregate({
      where: {
        tenantId,
        status: 'PAID',
        capturedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _sum: {
        netAmount: true,
        taxAmount: true,
        amount: true, // ✅ Use 'amount' not 'fareTotal'
      },
      _count: { _all: true },
    });

    const fareSubtotal = Number(revenueData._sum?.netAmount || 0);
    const taxAmount = Number(revenueData._sum?.taxAmount || 0);
    const fareTotal = Number(revenueData._sum?.amount || 0);

    const paymentCount = revenueData._count?._all || 0;
    const avgFareTotal = paymentCount > 0 ? fareTotal / paymentCount : 0;

    return {
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      currency: 'EUR',
      totals: {
        fareSubtotal,
        taxAmount,
        fareTotal,
      },
      averages: {
        avgFareTotal: Number(avgFareTotal.toFixed(2)),
      },
    };
  }

  async getPaymentsSummary(
    tenantId: string,
    query: { period: 'all_time' | 'current_month' | 'today' },
  ): Promise<PaymentSummaryResponse> {
    const { fromDate, toDate } = await this.getDateRange(
      tenantId,
      query.period,
    );

    const byStatus = await this.prisma.payment.groupBy({
      by: ['status'],
      where: {
        tenantId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _count: { _all: true },
      _sum: { amount: true },
    });

    const byProvider = await this.prisma.payment.groupBy({
      by: ['provider'],
      where: {
        tenantId,
        capturedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _count: { _all: true },
      _sum: { amount: true },
    });

    const response: PaymentSummaryResponse = {
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      currency: 'EUR',
      counts: {
        paid: 0,
        pending: 0,
        failed: 0,
        refunded: 0,
        requiresAction: 0,
      },
      amounts: {
        paid: 0,
        pending: 0,
        failed: 0,
        refunded: 0,
      },
      breakdown: {
        method: {
          cash: {
            count: 0,
            amount: 0,
          },
          viva: {
            count: 0,
            amount: 0,
          },
        },
      },
    };

    for (const row of byStatus) {
      const count = row._count._all;
      const amount = row._sum.amount ?? 0;

      switch (row.status) {
        case 'PAID':
          response.counts.paid = count;
          response.amounts.paid = Number(amount);
          break;
        case 'PENDING':
          response.counts.pending = count;
          response.amounts.pending = Number(amount);
          break;
        case 'FAILED':
          response.counts.failed = count;
          response.amounts.failed = Number(amount);
          break;
        case 'REFUNDED':
          response.counts.refunded = count;
          response.amounts.refunded = Number(amount);
          break;
        case 'REQUIRES_ACTION':
          response.counts.requiresAction = count;
          break;
      }
    }

    for (const row of byProvider) {
      const count = row._count._all;
      const amount = row._sum.amount ?? 0;

      switch (row.provider) {
        case 'CASH':
          response.breakdown.method.cash = { count, amount: Number(amount) };
          break;

        case 'VIVA':
          response.breakdown.method.viva = { count, amount: Number(amount) };
          break;
      }
    }

    return response;
  }

  // test the endpoint in postman
  async getLiveOperations(tenantId: string): Promise<LiveOperations | string> {
    const ongoingRidesData = await this.prisma.ride.findMany({
      where: {
        tenantId,
        status: 'ONGOING',
      },
      select: {
        id: true,
        status: true,
        driverProfileId: true,
        startedAt: true,
        pricingMode: true,
        driverProfile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!ongoingRidesData || ongoingRidesData.length === 0) {
      return 'No ongoing rides at the moment.';
    }
    const counts = await this.prisma.ride.aggregate({
      where: {
        tenantId,
        status: 'ONGOING',
      },
      _count: {
        _all: true,
        driverProfileId: true,
      },
    });

    return {
      ongoingRides: ongoingRidesData.map((ride) => ({
        rideId: ride.id,
        driverProfileId: ride.driverProfileId,
        driverName: `${ride.driverProfile.firstName} ${ride.driverProfile.lastName}`,
        startedAt: ride.startedAt.toISOString(),
        policy: ride.pricingMode,
        status: ride.status,
      })),
      counts: {
        ongoingRides: counts._count._all,
        driversOnRide: counts._count.driverProfileId,
      },
    };
  }

  async getDriverActivity(tenantId: string): Promise<DriverActivity> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new Error('Tenant not found');

    const activeDrivers = await this.prisma.driverProfile.groupBy({
      by: ['status'],
      where: { tenantId: tenant.id },
      _count: { _all: true },
    });

    const results = {
      total: 0,
      active: 0,
      invited: 0,
      inactive: 0,
    };

    for (const row of activeDrivers) {
      switch (row.status) {
        case 'ACTIVE':
          results.active = row._count._all;
          break;
        case 'INVITED':
          results.invited = row._count._all;
          break;
        case 'INACTIVE':
          results.inactive = row._count._all;
          break;
      }
    }

    results.total = results.active + results.invited + results.inactive;

    return { drivers: results };
  }

  async getPerformanceTrends(
    tenantId: string,
  ): Promise<PerformanceTrendsResponse> {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 24 * 60 * 60 * 1000); // last 24 hours

    const hourlyData = await this.prisma.$queryRaw<
      {
        hour: Date;
        ridesCompleted: BigInt;
        fareTotal: number;
      }[]
    >`
    SELECT 
      DATE_TRUNC('hour', "startedAt") as hour,
      COUNT(*)::int as "ridesCompleted",
      COALESCE(SUM("fareTotal"), 0)::float as "fareTotal"
    FROM "Ride"
    WHERE "tenantId" = ${tenantId}
      AND "status" = 'COMPLETED'
      AND "startedAt" >= ${fromDate}
      AND "startedAt" <= ${toDate}
    GROUP BY DATE_TRUNC('hour', "startedAt")
    ORDER BY hour ASC
  `;

    const busiest = hourlyData.reduce(
      (max, curr) =>
        Number(curr.ridesCompleted) > Number(max.ridesCompleted) ? curr : max,
      hourlyData[0] || { hour: new Date(), ridesCompleted: 0n, fareTotal: 0 },
    );

    return {
      interval: 'hourly',
      currency: 'EUR',
      points: hourlyData.map((point) => ({
        timestamp: point.hour.toISOString(),
        ridesCompleted: Number(point.ridesCompleted),
        fareTotal: Number(point.fareTotal),
      })),
      busiest: {
        time: busiest.hour.toISOString(),
        ridesCompleted: Number(busiest.ridesCompleted),
      },
    };
  }

  async getPaymentSystemHealth(
    tenantId: string,
  ): Promise<PaymentSystemHealthResponse> {

    const vivaAccount = await this.prisma.vivaAccount.findUnique({
      where: { tenantId, provider: 'VIVA' },
      select: {
        merchantId: true,
        connectedAt: true,
        liveMode: true,
        tenant: {
          select: {
            id: true,
            name: true,
            businessId: true,
          }
        }
      }
    })

    if (!vivaAccount) {
      return {
        provider: 'VIVA',
        status: "DISCONNECTED",
        exertnalAccountIdMasked: 'N/A',
        connectedAt: 'N/A',
        liveMode: false,
        error: 'No Viva account connected for this tenant',
        webhooks: {
          lastReceivedAt: 'N/A',
          failedLast24h: 0,
        }
      }
    }


    const maskedMerchantId = vivaAccount.merchantId
      ? '****' + vivaAccount.merchantId.slice(-4)
      : '****'
      
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [lastWebhook, failedCount] = await Promise.all([
      this.prisma.webhookEvent.findFirst({
        where: {
          provider: 'VIVA',
          ride: { tenantId },
          processedAt: { not: null },
        },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      }),

      this.prisma.webhookEvent.count({
        where: {
          provider: 'VIVA',
          ride: { tenantId },
          receivedAt: { gte: last24h },
          processedAt: null,
          attemptCount: { gt: 0 },
          errorMessage: { not: null },
        }
      })
    ])

    let status: "CONNECTED" | "ERROR" | "WARNING";
    let error: string | undefined;

    if (failedCount > 10) {
      status = "ERROR";
      error = `High number of failed webhooks in the last 24h: ${failedCount}`;

    } else if (failedCount > 0) {
      status = "WARNING";
      error = `Some webhooks failed in the last 24h: ${failedCount}`;
    } else if (!lastWebhook && vivaAccount.connectedAt) {
      //account is connected but no webhooks received yet

      const hoursSinceConnection = 
        (Date.now() - vivaAccount.connectedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceConnection > 24) {
        status = "WARNING";
        error = "No webhooks received in 24+ hours";
      } else {
        status = "CONNECTED";
      }
    } else {
      status = "CONNECTED";
    }

    return {
      provider: 'VIVA',
      status,
      exertnalAccountIdMasked: maskedMerchantId || null,
      connectedAt: vivaAccount.connectedAt.toISOString(),
      liveMode: vivaAccount.liveMode,
      error,
      webhooks: {
        lastReceivedAt: lastWebhook?.receivedAt.toISOString() || null,
        failedLast24h: failedCount
      }
    };
  }
}
