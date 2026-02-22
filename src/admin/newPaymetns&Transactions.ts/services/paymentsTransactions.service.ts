import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PaymentStatus, PaymentProvider, Prisma } from '@prisma/client';
import { TenantScopedService } from 'src/common/services/tenant-scoped.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  GetPaymentsTransactionsResponse,
  ProfitChartResponse,
  ProfitGranularity,
} from '../dtos/paymentsTransactionsDtos';
import {
  GetPaymentsQueryDto,
  GetPaymentsResponseDto,
  PaymentRowDto,
  PaymentSortField,
  PaymentFlag,
} from '../dtos/getPayments.dto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Cursor format: base64-encoded JSON with sort value and ID
 * Example: { sortValue: '2025-01-15T10:30:00Z', id: 'uuid' }
 */
interface CursorData {
  sortValue: string | number;
  id: string;
}

@Injectable()
export class PaymentsTransactionsService extends TenantScopedService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(REQUEST) request: Express.Request,
  ) {
    super(request);
  }

  async getDateRange(
    tenantId: string,
    period: 'all_time' | 'current_month' | 'this_week' | 'this_year',
  ): Promise<{ fromDate: Date; toDate: Date }> {
    const toDate = new Date(); // now
    let fromDate: Date;

    switch (period) {
      case 'this_year':
        fromDate = new Date(toDate.getFullYear(), 0, 1);
        break;
      case 'this_week':
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to start from Monday
        fromDate = new Date(today.getFullYear(), today.getMonth(), diff);
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
  async getPaymentsTransactions(
    period: 'all_time' | 'current_month' | 'this_week' | 'this_year',
  ): Promise<GetPaymentsTransactionsResponse> {
    const tenantId = this.getCurrentTenantId();

    const { fromDate, toDate } = await this.getDateRange(tenantId, period);

    // Get all possible providers to ensure all appear in response
    const allProviders = Object.values(PaymentProvider);
    const allStatuses = Object.values(PaymentStatus);

    // 1. Get ride totals (fareSubtotal, taxAmount, fareTotal) from rides with captured payments
    const rideTotals = await this.prisma.ride.aggregate({
      where: {
        tenantId,
        payment: {
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
          status: PaymentStatus.PAID,
        },
      },
      _sum: {
        fareSubtotal: true,
        taxAmount: true,
        fareTotal: true,
      },
    });

    // 2. Get amounts grouped by provider
    const amountsByProvider = await this.prisma.payment.groupBy({
      by: ['provider'],
      where: {
        tenantId,
        capturedAt: {
          gte: fromDate,
          lte: toDate,
        },
        status: PaymentStatus.PAID,
      },
      _sum: {
        amount: true,
        netAmount: true,
        taxAmount: true,
      },
    });

    // 3. Get amounts grouped by status
    const amountsByStatus = await this.prisma.payment.groupBy({
      by: ['status'],
      where: {
        tenantId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _sum: {
        amount: true,
        netAmount: true,
        taxAmount: true,
      },
    });

    // 4. Get counts by provider
    const countsByProvider = await this.prisma.payment.groupBy({
      by: ['provider'],
      where: {
        tenantId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
        status: PaymentStatus.PAID,
      },
      _count: {
        _all: true,
      },
    });

    // 5. Get counts by status
    const countsByStatus = await this.prisma.payment.groupBy({
      by: ['status'],
      where: {
        tenantId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _count: {
        _all: true,
      },
    });

    // 6. Get total count
    const totalCount = await this.prisma.payment.count({
      where: {
        tenantId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    // 7. Calculate comparison with previous period
    const periodDuration = toDate.getTime() - fromDate.getTime();
    const previousFromDate = new Date(fromDate.getTime() - periodDuration);
    const previousToDate = fromDate;

    const previousPeriodTotal = await this.prisma.ride.aggregate({
      where: {
        tenantId,
        payment: {
          createdAt: {
            gte: previousFromDate,
            lte: previousToDate,
          },
          status: PaymentStatus.PAID,
        },
      },
      _sum: {
        fareTotal: true,
      },
    });

    const currentTotal = rideTotals._sum?.fareTotal?.toNumber() || 0;
    const previousTotal = previousPeriodTotal._sum?.fareTotal?.toNumber() || 0;

    let comparison = '0%';
    if (previousTotal > 0) {
      const percentChange =
        ((currentTotal - previousTotal) / previousTotal) * 100;
      comparison = `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%`;
    } else if (currentTotal > 0) {
      comparison = '+100%';
    }

    // 8. Build complete response with all providers (ensure 0 values are included)

    // Create maps for easy lookup
    const amountsProviderMap = new Map(
      amountsByProvider.map((g) => [g.provider, g]),
    );
    const countsProviderMap = new Map(
      countsByProvider.map((g) => [g.provider, g]),
    );
    const amountsStatusMap = new Map(amountsByStatus.map((g) => [g.status, g]));
    const countsStatusMap = new Map(countsByStatus.map((g) => [g.status, g]));

    // Build complete arrays with all providers
    const completeAmountsByProvider = allProviders.map((provider) => {
      const data = amountsProviderMap.get(provider);
      return {
        provider,
        totalAmount: (data?._sum?.amount?.toNumber() || 0).toFixed(2),
        netAmount: (data?._sum?.netAmount?.toNumber() || 0).toFixed(2),
        taxAmount: (data?._sum?.taxAmount?.toNumber() || 0).toFixed(2),
      };
    });

    const completeCountsByProvider = allProviders.map((provider) => {
      const data = countsProviderMap.get(provider);
      return {
        provider,
        count: data?._count._all || 0,
      };
    });

    // Build complete arrays with all statuses
    const completeAmountsByStatus = allStatuses.map((status) => {
      const data = amountsStatusMap.get(status);
      return {
        status,
        totalAmount: (data?._sum?.amount?.toNumber() || 0).toFixed(2),
        netAmount: (data?._sum?.netAmount?.toNumber() || 0).toFixed(2),
        taxAmount: (data?._sum?.taxAmount?.toNumber() || 0).toFixed(2),
      };
    });

    const completeCountsByStatus = allStatuses.map((status) => {
      const data = countsStatusMap.get(status);
      return {
        status,
        count: data?._count._all || 0,
      };
    });

    return {
      period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      fareSubtotal: (rideTotals._sum?.fareSubtotal?.toNumber() || 0).toFixed(2),
      taxAmount: (rideTotals._sum?.taxAmount?.toNumber() || 0).toFixed(2),
      fareTotal: (rideTotals._sum?.fareTotal?.toNumber() || 0).toFixed(2),
      comparison,
      amounts: {
        byProvider: completeAmountsByProvider,
        byStatus: completeAmountsByStatus,
      },
      counts: {
        total: totalCount,
        byProvider: completeCountsByProvider,
        byStatus: completeCountsByStatus,
      },
    };
  }

  async getProfitTimeline(
    granularity: ProfitGranularity = ProfitGranularity.MONTH,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<ProfitChartResponse> {
    const tenantId = this.getCurrentTenantId();

    // Set default dates based on granularity if not provided
    const now = new Date();
    let from: Date;
    let to: Date;

    if (!fromDate || !toDate) {
      // Set defaults based on granularity
      switch (granularity) {
        case ProfitGranularity.YEAR:
          // Last 6 years
          from = fromDate || new Date(now.getFullYear() - 5, 0, 1, 0, 0, 0);
          to = toDate || new Date(now.getFullYear(), 11, 31, 23, 59, 59);
          break;
        case ProfitGranularity.MONTH:
          // Current year: Jan 1 to Dec 31
          from = fromDate || new Date(now.getFullYear(), 0, 1);
          to = toDate || new Date(now.getFullYear(), 11, 31, 23, 59, 59);
          break;
        case ProfitGranularity.WEEK:
          // Current month: 1st to last day
          from = fromDate || new Date(now.getFullYear(), now.getMonth(), 1);
          to =
            toDate ||
            new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          break;
        case ProfitGranularity.DAY:
          // Current week: Monday to Sunday
          const dayOfWeek = now.getDay();
          const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          from =
            fromDate ||
            new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
          to =
            toDate ||
            new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
          break;
      }
    } else {
      from = fromDate;
      to = toDate;
    }

    // Execute appropriate query based on granularity
    let results: Array<{ period: string; profit: any }>;

    switch (granularity) {
      case ProfitGranularity.YEAR:
        // Show all years (max last 6 years)
        results = await this.prisma.$queryRaw`
          WITH years AS (
            SELECT generate_series(
              EXTRACT(YEAR FROM ${from}::timestamp)::int,
              EXTRACT(YEAR FROM ${to}::timestamp)::int
            )::text as year
          )
          SELECT 
            y.year as period,
            COALESCE(SUM(p."netAmount"), 0) as profit
          FROM years y
          LEFT JOIN "Payment" p 
            ON EXTRACT(YEAR FROM p."createdAt")::text = y.year
            AND p."tenantId" = ${tenantId}
            AND p.status::text = ${PaymentStatus.PAID}
          GROUP BY y.year
          ORDER BY y.year ASC
        `;
        break;

      case ProfitGranularity.MONTH:
        // Show all 12 months in the current year
        results = await this.prisma.$queryRaw`
          WITH months AS (
            SELECT generate_series(
              DATE_TRUNC('month', ${from}::timestamp),
              DATE_TRUNC('month', ${to}::timestamp),
              '1 month'::interval
            ) as month_start
          )
          SELECT 
            TO_CHAR(m.month_start, 'YYYY-MM') as period,
            COALESCE(SUM(p."netAmount"), 0) as profit
          FROM months m
          LEFT JOIN "Payment" p 
            ON DATE_TRUNC('month', p."createdAt") = m.month_start
            AND p."tenantId" = ${tenantId}
            AND p.status::text = ${PaymentStatus.PAID}
          GROUP BY m.month_start
          ORDER BY m.month_start ASC
        `;
        break;

      case ProfitGranularity.WEEK:
        // Show all weeks in the current month
        results = await this.prisma.$queryRaw`
          WITH weeks AS (
            SELECT generate_series(
              DATE_TRUNC('week', ${from}::timestamp),
              DATE_TRUNC('week', ${to}::timestamp),
              '1 week'::interval
            ) as week_start
          )
          SELECT 
            TO_CHAR(w.week_start, 'YYYY-"W"IW') as period,
            COALESCE(SUM(p."netAmount"), 0) as profit
          FROM weeks w
          LEFT JOIN "Payment" p 
            ON DATE_TRUNC('week', p."createdAt") = w.week_start
            AND p."tenantId" = ${tenantId}
            AND p.status::text = ${PaymentStatus.PAID}
          GROUP BY w.week_start
          ORDER BY w.week_start ASC
        `;
        break;

      case ProfitGranularity.DAY:
        // Show all days in the current week
        results = await this.prisma.$queryRaw`
          WITH days AS (
            SELECT generate_series(
              DATE_TRUNC('day', ${from}::timestamp),
              DATE_TRUNC('day', ${to}::timestamp),
              '1 day'::interval
            ) as day_start
          )
          SELECT 
            TO_CHAR(d.day_start, 'YYYY-MM-DD') as period,
            COALESCE(SUM(p."netAmount"), 0) as profit
          FROM days d
          LEFT JOIN "Payment" p 
            ON DATE_TRUNC('day', p."createdAt") = d.day_start
            AND p."tenantId" = ${tenantId}
            AND p.status::text = ${PaymentStatus.PAID}
          GROUP BY d.day_start
          ORDER BY d.day_start ASC
        `;
        break;

      default:
        throw new Error(`Unsupported granularity: ${granularity}`);
    }

    // Transform results to response format
    const data = results.map((row) => {
      const profitValue =
        typeof row.profit === 'object' && 'toNumber' in row.profit
          ? row.profit.toNumber()
          : Number(row.profit);

      // Create timestamp for sorting/reference
      let timestamp: string;
      switch (granularity) {
        case ProfitGranularity.YEAR:
          // Format is "YYYY" (year)
          timestamp = new Date(`${row.period}-01-01`).toISOString();
          break;
        case ProfitGranularity.MONTH:
          // Format is "YYYY-MM" (month)
          timestamp = new Date(`${row.period}-01`).toISOString();
          break;
        case ProfitGranularity.WEEK:
          // Format is "YYYY-WNN" (week)
          const [year, week] = row.period.split('-W');
          const jan1 = new Date(parseInt(year), 0, 1);
          const daysToAdd = (parseInt(week) - 1) * 7;
          timestamp = new Date(
            jan1.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
          ).toISOString();
          break;
        case ProfitGranularity.DAY:
          // Format is "YYYY-MM-DD" (day)
          timestamp = new Date(row.period).toISOString();
          break;
        default:
          timestamp = new Date().toISOString();
      }

      return {
        label: row.period,
        profit: profitValue.toFixed(2),
        timestamp,
      };
    });

    // Calculate total profit
    const total = data
      .reduce((sum, item) => sum + parseFloat(item.profit), 0)
      .toFixed(2);

    return {
      granularity,
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      data,
      total,
    };
  }

  /**
   * Get paginated payments list with filters
   */
  async getPaymentsList(
    dto: GetPaymentsQueryDto,
  ): Promise<GetPaymentsResponseDto> {
    const tenantId = this.getCurrentTenantId();

    // Set defaults
    const limit = dto.limit || 20;
    const sortBy: PaymentSortField = dto.sortBy || 'createdAt';
    const sortDir = dto.sortDir || 'desc';
    const cursorDir = dto.cursorDir || 'next';

    // Build where clause
    const where = this.buildPaymentsWhereClause(tenantId, dto);

    // Decode cursor if provided
    let cursorData: CursorData | null = null;
    if (dto.cursor) {
      try {
        const decoded = Buffer.from(dto.cursor, 'base64').toString('utf-8');
        cursorData = JSON.parse(decoded);
      } catch (error) {
        // Invalid cursor, ignore it
        cursorData = null;
      }
    }

    // Build orderBy and cursor conditions
    const orderBy = this.buildPaymentsOrderBy(sortBy, sortDir);
    const cursorWhere = cursorData
      ? this.buildPaymentsCursorWhere(sortBy, sortDir, cursorDir, cursorData)
      : {};

    // Combine where clauses
    const finalWhere = { ...where, ...cursorWhere };

    // Fetch payments with pagination (fetch limit + 1 to check if there's more)
    const payments = await this.prisma.payment.findMany({
      where: finalWhere,
      orderBy,
      take: cursorDir === 'prev' ? -(limit + 1) : limit + 1,
      select: {
        id: true,
        status: true,
        provider: true,
        amount: true,
        taxAmount: true,
        netAmount: true,
        currency: true,
        createdAt: true,
        capturedAt: true,
        authorizedAt: true,
        externalPaymentId: true,
        invoiceNumber: true,
        receiptNumber: true,
        approvalCode: true,
        failureCode: true,
        ride: {
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
            status: true,
            fareTotal: true,
            distanceKm: true,
            durationMin: true,
            driverProfile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Handle backwards pagination (reverse the results)
    let hasNext = false;
    let hasPrev = false;
    let paymentsToReturn = payments;

    if (cursorDir === 'prev') {
      if (payments.length > limit) {
        hasPrev = true;
        paymentsToReturn = payments.slice(1).reverse();
      } else {
        paymentsToReturn = payments.reverse();
      }
      hasNext = !!cursorData; // If we're going backwards, there's always a next page
    } else {
      // Forward pagination
      if (payments.length > limit) {
        hasNext = true;
        paymentsToReturn = payments.slice(0, limit);
      }
      hasPrev = !!cursorData; // If we have a cursor, there's a previous page
    }

    // Map to DTOs
    const paymentRows: PaymentRowDto[] = paymentsToReturn.map((payment) =>
      this.mapToPaymentRowDto(payment),
    );

    // Generate cursors
    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    if (hasNext && paymentRows.length > 0) {
      const lastPayment = paymentRows[paymentRows.length - 1];
      nextCursor = this.encodeCursor({
        sortValue: this.getSortValue(lastPayment, sortBy),
        id: lastPayment.id,
      });
    }

    if (hasPrev && paymentRows.length > 0) {
      const firstPayment = paymentRows[0];
      prevCursor = this.encodeCursor({
        sortValue: this.getSortValue(firstPayment, sortBy),
        id: firstPayment.id,
      });
    }

    return {
      payments: paymentRows,
      page: {
        hasNext,
        hasPrev,
        nextCursor,
        prevCursor,
        totalInPage: paymentRows.length,
      },
    };
  }

  /**
   * Build WHERE clause for payments query
   */
  private buildPaymentsWhereClause(
    tenantId: string,
    dto: GetPaymentsQueryDto,
  ): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {
      tenantId,
    };

    // Date range filter (on createdAt)
    if (dto.from || dto.to) {
      where.createdAt = {};
      if (dto.from) {
        where.createdAt.gte = new Date(dto.from);
      }
      if (dto.to) {
        where.createdAt.lt = new Date(dto.to);
      }
    }

    // Status filter (comma-separated)
    if (dto.status) {
      const statuses = dto.status
        .split(',')
        .map((s) => s.trim())
        .filter((s) =>
          Object.values(PaymentStatus).includes(s as PaymentStatus),
        );
      if (statuses.length > 0) {
        where.status = { in: statuses as PaymentStatus[] };
      }
    }

    // Provider filter (comma-separated)
    if (dto.provider) {
      const providers = dto.provider
        .split(',')
        .map((p) => p.trim())
        .filter((p) =>
          Object.values(PaymentProvider).includes(p as PaymentProvider),
        );
      if (providers.length > 0) {
        where.provider = { in: providers as PaymentProvider[] };
      }
    }

    // Driver filter
    if (dto.driverId) {
      where.ride = {
        driverProfileId: dto.driverId,
      };
    }

    // Ride filter
    if (dto.rideId) {
      where.rideId = dto.rideId;
    }

    // Text search (payment ID, externalPaymentId, invoiceNumber, receiptNumber)
    if (dto.q) {
      where.OR = [
        { id: { startsWith: dto.q } },
        { externalPaymentId: { startsWith: dto.q } },
        { invoiceNumber: { startsWith: dto.q } },
        { receiptNumber: { startsWith: dto.q } },
      ];
    }

    return where;
  }

  /**
   * Build ORDER BY clause
   */
  private buildPaymentsOrderBy(
    sortBy: PaymentSortField,
    sortDir: 'asc' | 'desc',
  ): Prisma.PaymentOrderByWithRelationInput[] {
    const orderBy: Prisma.PaymentOrderByWithRelationInput[] = [];

    // Primary sort field
    orderBy.push({ [sortBy]: sortDir });

    // Always include id as tie-breaker for stable sorting
    orderBy.push({ id: sortDir });

    return orderBy;
  }

  /**
   * Build cursor WHERE condition for pagination
   */
  private buildPaymentsCursorWhere(
    sortBy: PaymentSortField,
    sortDir: 'asc' | 'desc',
    cursorDir: 'next' | 'prev',
    cursorData: CursorData,
  ): Prisma.PaymentWhereInput {
    // Determine comparison operator
    let useGt = false;
    if (cursorDir === 'next') {
      useGt = sortDir === 'desc' ? false : true; // next + desc = <, next + asc = >
    } else {
      useGt = sortDir === 'desc' ? true : false; // prev + desc = >, prev + asc = <
    }

    const operator = useGt ? 'gt' : 'lt';
    const equalOperator = useGt ? 'gte' : 'lte';

    // Build compound condition: (sortField, id) comparison
    return {
      OR: [
        {
          [sortBy]: {
            [operator]:
              sortBy === 'createdAt' || sortBy === 'capturedAt'
                ? new Date(cursorData.sortValue as string)
                : cursorData.sortValue,
          },
        },
        {
          [sortBy]:
            sortBy === 'createdAt' || sortBy === 'capturedAt'
              ? new Date(cursorData.sortValue as string)
              : cursorData.sortValue,
          id: { [operator]: cursorData.id },
        },
      ],
    };
  }

  /**
   * Map Payment to PaymentRowDto
   */
  private mapToPaymentRowDto(payment: any): PaymentRowDto {
    const flags = this.detectPaymentFlags(payment);

    return {
      id: payment.id,
      status: payment.status,
      provider: payment.provider,
      amount: payment.amount.toString(),
      taxAmount: payment.taxAmount?.toString() || null,
      netAmount: payment.netAmount?.toString() || null,
      currency: payment.currency,
      createdAt: payment.createdAt.toISOString(),
      capturedAt: payment.capturedAt?.toISOString() || null,
      authorizedAt: payment.authorizedAt?.toISOString() || null,
      externalPaymentId: payment.externalPaymentId || null,
      invoiceNumber: payment.invoiceNumber || null,
      receiptNumber: payment.receiptNumber || null,
      approvalCode: payment.approvalCode || null,
      failureCode: payment.failureCode || null,
      ride: {
        id: payment.ride.id,
        startedAt: payment.ride.startedAt.toISOString(),
        endedAt: payment.ride.endedAt?.toISOString() || null,
        status: payment.ride.status,
        fareTotal: payment.ride.fareTotal.toString(),
        distanceKm: payment.ride.distanceKm,
        durationMin: payment.ride.durationMin,
        driverProfile: {
          id: payment.ride.driverProfile.id,
          firstName: payment.ride.driverProfile.firstName,
          lastName: payment.ride.driverProfile.lastName,
        },
      },
      flags,
    };
  }

  /**
   * Detect payment flags for problem detection
   */
  private detectPaymentFlags(payment: any): PaymentFlag[] {
    const flags: PaymentFlag[] = [];
    const now = new Date();

    // REFUND_NEEDED
    if (payment.status === PaymentStatus.REFUNDED) {
      flags.push('REFUND_NEEDED');
    }

    // REQUIRES_ACTION
    if (payment.status === PaymentStatus.REQUIRES_ACTION) {
      flags.push('REQUIRES_ACTION');
    }

    // FAILED
    if (payment.status === PaymentStatus.FAILED) {
      flags.push('FAILED');
    }

    // LONG_PENDING (pending for more than 24 hours)
    if (payment.status === PaymentStatus.PENDING) {
      const hoursSinceCreated =
        (now.getTime() - payment.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreated > 24) {
        flags.push('LONG_PENDING');
      }
    }

    // MISSING_CAPTURE (authorized but not captured after 24 hours)
    if (payment.authorizedAt && !payment.capturedAt) {
      const hoursSinceAuthorized =
        (now.getTime() - payment.authorizedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceAuthorized > 24) {
        flags.push('MISSING_CAPTURE');
      }
    }

    // MISSING_INVOICE (paid but no invoice number)
    if (payment.status === PaymentStatus.PAID && !payment.invoiceNumber) {
      flags.push('MISSING_INVOICE');
    }

    // MISSING_RECEIPT (paid but no receipt number)
    if (payment.status === PaymentStatus.PAID && !payment.receiptNumber) {
      flags.push('MISSING_RECEIPT');
    }

    return flags;
  }

  /**
   * Get sort value from payment for cursor generation
   */
  private getSortValue(
    payment: PaymentRowDto,
    sortBy: PaymentSortField,
  ): string | number {
    switch (sortBy) {
      case 'createdAt':
        return payment.createdAt;
      case 'capturedAt':
        return payment.capturedAt || payment.createdAt; // Fallback to createdAt if null
      case 'amount':
        return parseFloat(payment.amount);
      default:
        return payment.createdAt;
    }
  }

  /**
   * Encode cursor to base64
   */
  private encodeCursor(data: CursorData): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }
}
