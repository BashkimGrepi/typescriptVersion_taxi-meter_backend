import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ReportsQueryDto,
  RevenueReportResponse,
  RevenueReportItem,
  DriverPerformanceResponse,
  DriverPerformanceItem,
  PaymentMethodReportResponse,
  PaymentMethodReportItem,
} from '../dto/report-admin.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { RideStatus } from '@prisma/client';
import { REQUEST } from '@nestjs/core';
import { request } from 'express';
import { TenantScopedService } from 'src/common/services/tenant-scoped.service';

@Injectable()
export class AdminReportService extends TenantScopedService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(REQUEST) request: Express.Request,
  ) {
    super(request);
  }

  async getRevenueReport(
    tenantId: string,
    query: ReportsQueryDto,
  ): Promise<RevenueReportResponse> {
    const { from, to, driverId, granularity = 'daily' } = query;

    // Build date range
    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const toDate = to ? new Date(to) : new Date();

    // Build filter conditions
    const where: any = {
      tenantId,
      status: RideStatus.COMPLETED,
      endedAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (driverId) {
      where.driverProfileId = driverId;
    }

    // Get rides data
    const rides = await this.prisma.ride.findMany({
      where,
      select: {
        endedAt: true,
        fareTotal: true,
        distanceKm: true,
        durationMin: true,
      },
      orderBy: { endedAt: 'asc' },
    });

    // Group by time period
    const periodData = this.groupRidesByPeriod(rides, granularity);

    // Calculate summary
    const totalRides = rides.length;
    const totalRevenue = rides.reduce(
      (sum, ride) => sum.add(ride.fareTotal || new Decimal(0)),
      new Decimal(0),
    );
    const totalDistance = rides.reduce(
      (sum, ride) => sum.add(ride.distanceKm || new Decimal(0)),
      new Decimal(0),
    );
    const totalDuration = rides.reduce(
      (sum, ride) => sum.add(ride.durationMin || new Decimal(0)),
      new Decimal(0),
    );

    const daysDiff = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const avgRevenuePerDay =
      totalRides > 0 ? totalRevenue.div(daysDiff) : new Decimal(0);
    const avgFarePerRide =
      totalRides > 0 ? totalRevenue.div(totalRides) : new Decimal(0);
    const totalDurationHours = totalDuration.div(60);

    return {
      period: `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`,
      data: periodData,
      summary: {
        totalRides,
        totalRevenue: totalRevenue.toString(),
        avgRevenuePerDay: avgRevenuePerDay.toString(),
        avgFarePerRide: avgFarePerRide.toString(),
        totalDistanceKm: totalDistance.toString(),
        totalDurationHours: totalDurationHours.toString(),
      },
    };
  }

  async getDriverPerformanceReport(
    tenantId: string,
    query: ReportsQueryDto,
  ): Promise<DriverPerformanceResponse> {
    const { from, to } = query;

    // Build date range
    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    // Get driver performance data
    const driverStats = await this.prisma.ride.groupBy({
      where: {
        tenantId,
        status: RideStatus.COMPLETED,
        endedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      by: ['driverProfileId'],
      _count: { _all: true },
      _sum: {
        fareTotal: true,
        distanceKm: true,
        durationMin: true,
      },
    });

    // Get driver names
    const driverProfiles = await this.prisma.driverProfile.findMany({
      where: {
        tenantId,
        id: { in: driverStats.map((stat) => stat.driverProfileId) },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const driverMap = new Map(
      driverProfiles.map((driver) => [driver.id, driver]),
    );
    const daysDiff = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Transform to response format
    const drivers: DriverPerformanceItem[] = driverStats.map((stat) => {
      const driver = driverMap.get(stat.driverProfileId);
      const rideCount = stat._count?._all || 0;
      const totalRevenue = stat._sum?.fareTotal || new Decimal(0);
      const totalDistance = stat._sum?.distanceKm || new Decimal(0);
      const totalDuration = stat._sum?.durationMin || new Decimal(0);

      return {
        driverProfileId: stat.driverProfileId,
        firstName: driver?.firstName || 'Unknown',
        lastName: driver?.lastName || 'Driver',
        rideCount,
        totalRevenue: totalRevenue.toString(),
        avgFarePerRide:
          rideCount > 0 ? totalRevenue.div(rideCount).toString() : '0',
        totalDistanceKm: totalDistance.toString(),
        totalDurationHours: totalDuration.div(60).toString(),
        avgRidesPerDay: daysDiff > 0 ? (rideCount / daysDiff).toFixed(1) : '0',
      };
    });

    // Sort by total revenue descending
    drivers.sort(
      (a, b) => parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue),
    );

    // Calculate fleet summary
    const totalDrivers = await this.prisma.driverProfile.count({
      where: { tenantId },
    });
    const activeDrivers = drivers.length;
    const totalRides = drivers.reduce(
      (sum, driver) => sum + driver.rideCount,
      0,
    );
    const totalRevenue = drivers.reduce(
      (sum, driver) => sum.add(new Decimal(driver.totalRevenue)),
      new Decimal(0),
    );
    const avgRidesPerDriver =
      activeDrivers > 0 ? (totalRides / activeDrivers).toFixed(1) : '0';
    const avgRevenuePerDriver =
      activeDrivers > 0 ? totalRevenue.div(activeDrivers).toString() : '0';

    return {
      period: `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`,
      drivers,
      fleetSummary: {
        totalDrivers,
        activeDrivers,
        totalRides,
        totalRevenue: totalRevenue.toString(),
        avgRidesPerDriver,
        avgRevenuePerDriver,
      },
    };
  }

  async getPaymentMethodReport(
    tenantId: string,
    query: ReportsQueryDto,
  ): Promise<PaymentMethodReportResponse> {
    const { from, to } = query;

    // Build date range - using ride relationship since Payment doesn't have createdAt
    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    // Get payment method statistics
    const paymentStats = await this.prisma.payment.groupBy({
      where: {
        tenantId,
        ride: {
          endedAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
      },
      by: ['provider'],
      _count: { _all: true },
      _sum: { amount: true },
    });

    // Get total rides for payment rate calculation
    const totalRides = await this.prisma.ride.count({
      where: {
        tenantId,
        status: RideStatus.COMPLETED,
        endedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    const totalPayments = paymentStats.reduce(
      (sum, stat) => sum + (stat._count?._all || 0),
      0,
    );
    const totalAmount = paymentStats.reduce(
      (sum, stat) => sum.add(stat._sum?.amount || new Decimal(0)),
      new Decimal(0),
    );

    // Transform to response format
    const paymentMethods: PaymentMethodReportItem[] = paymentStats.map(
      (stat) => {
        const paymentCount = stat._count?._all || 0;
        const amount = stat._sum?.amount || new Decimal(0);
        const percentage =
          totalPayments > 0 ? (paymentCount / totalPayments) * 100 : 0;

        return {
          paymentMethod: stat.provider,
          paymentCount,
          totalAmount: amount.toString(),
          percentage: parseFloat(percentage.toFixed(1)),
        };
      },
    );

    // Sort by total amount descending
    paymentMethods.sort(
      (a, b) => parseFloat(b.totalAmount) - parseFloat(a.totalAmount),
    );

    const avgPaymentAmount =
      totalPayments > 0 ? totalAmount.div(totalPayments).toString() : '0';
    const paymentRate =
      totalRides > 0 ? ((totalPayments / totalRides) * 100).toFixed(1) : '0';

    return {
      period: `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`,
      paymentMethods,
      summary: {
        totalPayments,
        totalAmount: totalAmount.toString(),
        avgPaymentAmount,
        paymentRate,
      },
    };
  }

  private groupRidesByPeriod(
    rides: any[],
    granularity: string,
  ): RevenueReportItem[] {
    const groups = new Map<string, any[]>();

    rides.forEach((ride) => {
      if (!ride.endedAt) return;

      const date = new Date(ride.endedAt);
      let periodKey: string;

      switch (granularity) {
        case 'weekly':
          // Get Monday of the week
          const monday = new Date(date);
          monday.setDate(date.getDate() - date.getDay() + 1);
          periodKey = monday.toISOString().split('T')[0];
          break;
        case 'monthly':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default: // daily
          periodKey = date.toISOString().split('T')[0];
      }

      if (!groups.has(periodKey)) {
        groups.set(periodKey, []);
      }
      groups.get(periodKey)!.push(ride);
    });

    // Convert groups to report items
    const items: RevenueReportItem[] = Array.from(groups.entries()).map(
      ([period, periodRides]) => {
        const rideCount = periodRides.length;
        const totalRevenue = periodRides.reduce(
          (sum, ride) => sum.add(ride.fareTotal || new Decimal(0)),
          new Decimal(0),
        );
        const totalDistance = periodRides.reduce(
          (sum, ride) => sum.add(ride.distanceKm || new Decimal(0)),
          new Decimal(0),
        );
        const totalDuration = periodRides.reduce(
          (sum, ride) => sum.add(ride.durationMin || new Decimal(0)),
          new Decimal(0),
        );

        const avgFarePerRide =
          rideCount > 0 ? totalRevenue.div(rideCount) : new Decimal(0);

        return {
          period,
          rideCount,
          totalRevenue: totalRevenue.toString(),
          avgFarePerRide: avgFarePerRide.toString(),
          totalDistanceKm: totalDistance.toString(),
          totalDurationMin: totalDuration.toString(),
        };
      },
    );

    // Sort by period
    items.sort((a, b) => a.period.localeCompare(b.period));
    return items;
  }

  async getDashboardSummary(
    tenantId: string,
    query: ReportsQueryDto,
  ): Promise<any> {
    const { from, to } = query;

    // Get tenant creation date for default 'from' date
    let fromDate: Date;
    if (from) {
      fromDate = new Date(from);
    } else {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { createdAt: true },
      });
      fromDate = tenant?.createdAt || new Date(0);
    }

    const toDate = to ? new Date(to) : new Date();

    // Fetch all data in parallel
    const [
      totalRides,
      completedRides,
      cancelledRides,
      ongoingRides,
      allDrivers,
      activeDriversData,
      revenueData,
      cardPayments,
      cashPayments,
      failedPayments,
    ] = await Promise.all([
      // 1. Total rides (all statuses)
      this.prisma.ride.count({
        where: { tenantId, startedAt: { gte: fromDate, lte: toDate } },
      }),

      // 2. Completed rides
      this.prisma.ride.count({
        where: {
          tenantId,
          status: RideStatus.COMPLETED,
          startedAt: { gte: fromDate, lte: toDate },
        },
      }),

      // 3. Cancelled rides
      this.prisma.ride.count({
        where: {
          tenantId,
          status: RideStatus.CANCELLED,
          startedAt: { gte: fromDate, lte: toDate },
        },
      }),

      // 4. Ongoing rides
      this.prisma.ride.count({
        where: {
          tenantId,
          status: RideStatus.ONGOING,
          startedAt: { gte: fromDate, lte: toDate },
        },
      }),

      // 5. All drivers count
      this.prisma.driverProfile.count({
        where: { tenantId },
      }),

      // 6. Active drivers (who had completed rides in period)
      this.prisma.ride.findMany({
        where: {
          tenantId,
          status: RideStatus.COMPLETED,
          startedAt: { gte: fromDate, lte: toDate },
        },
        select: { driverProfileId: true },
        distinct: ['driverProfileId'],
      }),

      // 7. Revenue data
      this.prisma.ride.aggregate({
        where: {
          tenantId,
          status: RideStatus.COMPLETED,
          startedAt: { gte: fromDate, lte: toDate },
        },
        _sum: {
          fareSubtotal: true,
          taxAmount: true,
          fareTotal: true,
        },
      }),

      // 8. Card/Viva payments
      this.prisma.payment.aggregate({
        where: {
          tenantId,
          provider: 'VIVA',
          status: { in: ['PAID'] },
          ride: { startedAt: { gte: fromDate, lte: toDate } },
        },
        _sum: { amount: true },
      }),

      // 9. Cash payments
      this.prisma.payment.aggregate({
        where: {
          tenantId,
          provider: 'CASH',
          status: 'PAID',
          ride: { startedAt: { gte: fromDate, lte: toDate } },
        },
        _sum: { amount: true },
      }),

      // 10. Failed payments
      this.prisma.payment.aggregate({
        where: {
          tenantId,
          status: 'FAILED',
          ride: { startedAt: { gte: fromDate, lte: toDate } },
        },
        _sum: { amount: true },
      }),
    ]);

    // Helper function to format Decimal to string with 2 decimals
    const formatMoney = (d: Decimal | null | undefined): string => {
      if (!d) return '0.00';
      return d.toFixed(2);
    };

    return {
      period: `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`,
      rides: {
        total: totalRides,
        completed: completedRides,
        cancelled: cancelledRides,
        ongoing: ongoingRides,
        allDrivers: allDrivers,
        activeDrivers: activeDriversData.length,
      },
      revenue: {
        subtotal: formatMoney(revenueData._sum.fareSubtotal),
        tax: formatMoney(revenueData._sum.taxAmount),
        total: formatMoney(revenueData._sum.fareTotal),
      },
      paymentDistribution: {
        card: formatMoney(cardPayments._sum.amount),
        cash: formatMoney(cashPayments._sum.amount),
        failed: formatMoney(failedPayments._sum.amount),
      },
    };
  }
}
