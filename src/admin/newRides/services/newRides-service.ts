import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { TenantScopedService } from 'src/common/services/tenant-scoped.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  GetRidesQueryDto,
  GetRidesResponseDto,
  RideRowDto,
  RideSummaryDto,
  PageInfoDto,
  RideSortField,
  RideFlag,
  RideDetailResponseDto,
} from '../dto/newRides-dto';
import {
  PaymentProvider,
  PaymentStatus,
  RideStatus,
  Prisma,
} from '@prisma/client';
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
export class NewRidesService extends TenantScopedService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(REQUEST) request: Express.Request,
  ) {
    super(request);
  }

  /**
   * Main method: Get paginated rides with filters and summary aggregates
   */
  async getRidesList(dto: GetRidesQueryDto): Promise<GetRidesResponseDto> {
    const tenantId = this.getCurrentTenantId();

    // Set defaults
    const limit = dto.limit || 20;
    const sortBy: RideSortField = dto.sortBy || 'startedAt';
    const sortDir = dto.sortDir || 'desc';
    const cursorDir = dto.cursorDir || 'next';

    // Build where clause
    const where = this.buildWhereClause(tenantId, dto);

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
    const orderBy = this.buildOrderBy(sortBy, sortDir);
    const cursorWhere = cursorData
      ? this.buildCursorWhere(sortBy, sortDir, cursorDir, cursorData)
      : {};

    // Combine where clauses
    const finalWhere = { ...where, ...cursorWhere };

    // Fetch rides with pagination (fetch limit + 1 to check if there's more)
    const rides = await this.prisma.ride.findMany({
      where: finalWhere,
      orderBy,
      take: cursorDir === 'prev' ? -(limit + 1) : limit + 1,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        status: true,
        durationMin: true,
        distanceKm: true,
        fareTotal: true,
        taxAmount: true,
        fareSubtotal: true,
        driverProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        payment: {
          select: {
            status: true,
            provider: true,
            externalPaymentId: true,
            currency: true, // Added for ride row
          },
        },
      },
    });

    // Handle prev direction (reverse results)
    let processedRides = rides;
    if (cursorDir === 'prev') {
      processedRides = rides.reverse();
    }

    // Check if there's more data
    const hasMore = processedRides.length > limit;
    const paginatedRides = hasMore
      ? processedRides.slice(0, limit)
      : processedRides;

    // Calculate summary aggregates in parallel
    const summary = await this.calculateSummary(where);

    // Generate cursors
    const page = this.generatePageInfo(
      paginatedRides,
      sortBy,
      hasMore,
      cursorDir,
      limit,
    );

    // Transform rides to DTO
    const data: RideRowDto[] = paginatedRides.map((ride) => ({
      id: ride.id,
      startedAt: ride.startedAt.toISOString(),
      endedAt: ride.endedAt?.toISOString() || null,
      status: ride.status,
      driver: {
        id: ride.driverProfile.id,
        name: `${ride.driverProfile.firstName} ${ride.driverProfile.lastName}`,
      },
      durationMin: ride.durationMin?.toString() || null,
      distanceKm: ride.distanceKm?.toString() || null,
      fareTotal: ride.fareTotal?.toString() || null,
      taxAmount: ride.taxAmount?.toString() || null,
      fareSubtotal: ride.fareSubtotal?.toString() || null,
      currency: ride.payment?.currency || 'EUR',
      payment: ride.payment
        ? {
            status: ride.payment.status,
            provider: ride.payment.provider,
            method: this.getPaymentMethod(ride.payment.provider),
            externalPaymentIdMasked: this.maskExternalPaymentId(
              ride.payment.externalPaymentId,
            ),
          }
        : null,
      flags: this.generateFlags(ride),
    }));

    return {
      data,
      page,
      summary,
    };
  }

  /**
   * Get detailed ride information by ID
   * For admin audit/review - returns full details including driver, pricing policy, and payment
   *
   * Security:
   * - Enforces tenant isolation (ride must belong to admin's tenant)
   * - Returns 404 if not found (don't leak existence across tenants)
   */
  async getRideById(rideId: string): Promise<RideDetailResponseDto> {
    const tenantId = this.getCurrentTenantId();

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(rideId)) {
      throw new BadRequestException('Invalid ride ID format');
    }

    // Fetch ride with all related data
    const ride = await this.prisma.ride.findUnique({
      where: {
        id: rideId,
        tenantId, // ✅ Tenant isolation enforced
      },
      select: {
        // Core ride data
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        durationMin: true,
        distanceKm: true,
        fareSubtotal: true,
        taxAmount: true,
        fareTotal: true,

        // Driver profile
        driverProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },

        // Pricing policy (if used)
        pricing: {
          select: {
            id: true,
            name: true,
            baseFare: true,
            perMin: true,
            perKm: true,
            createdAt: true,
          },
        },

        // Payment details
        payment: {
          select: {
            id: true,
            provider: true,
            status: true,
            amount: true,
            currency: true,
            authorizedAt: true,
            capturedAt: true,
            failureCode: true,
            externalPaymentId: true, // Full ID for admin audit (not masked)
          },
        },
      },
    });

    // Not found in this tenant
    if (!ride) {
      throw new NotFoundException(`Ride with ID ${rideId} not found`);
    }

    // Transform to response DTO
    return {
      id: ride.id,
      status: ride.status,
      startedAt: ride.startedAt.toISOString(),
      endedAt: ride.endedAt?.toISOString() || null,
      durationMin: ride.durationMin?.toString() || null,
      distanceKm: ride.distanceKm?.toString() || null,
      fareSubtotal: ride.fareSubtotal?.toString() || null,
      taxAmount: ride.taxAmount?.toString() || null,
      fareTotal: ride.fareTotal?.toString() || null,
      currency: ride.payment?.currency || 'EUR',
      driver: {
        id: ride.driverProfile.id,
        firstName: ride.driverProfile.firstName,
        lastName: ride.driverProfile.lastName,
        phone: ride.driverProfile.phone,
        email: ride.driverProfile.email,
      },
      pricingPolicy: ride.pricing
        ? {
            id: ride.pricing.id,
            name: ride.pricing.name,
            baseFare: ride.pricing.baseFare.toString(),
            perMinute: ride.pricing.perMin.toString(),
            perKm: ride.pricing.perKm.toString(),
            createdAt: ride.pricing.createdAt.toISOString(),
          }
        : null,
      payment: ride.payment
        ? {
            id: ride.payment.id,
            provider: ride.payment.provider,
            status: ride.payment.status,
            method: this.getPaymentMethod(ride.payment.provider),
            amount: ride.payment.amount.toString(),
            currency: ride.payment.currency,
            authorizedAt: ride.payment.authorizedAt?.toISOString() || null,
            capturedAt: ride.payment.capturedAt?.toISOString() || null,
            failureCode: ride.payment.failureCode,
            externalPaymentId: ride.payment.externalPaymentId, // ✅ Full ID for admin audit
          }
        : null,
    };
  }

  /**
   * Build Prisma where clause from query filters
   */
  private buildWhereClause(tenantId: string, dto: GetRidesQueryDto): any {
    const where: any = { tenantId };

    // Time range filter
    if (dto.from || dto.to) {
      where.startedAt = {};
      if (dto.from) {
        where.startedAt.gte = new Date(dto.from);
      }
      if (dto.to) {
        where.startedAt.lt = new Date(dto.to);
      }
    }

    // Status filter (comma-separated)
    if (dto.status) {
      const statuses = dto.status.split(',').map((s) => s.trim());
      const validStatuses = statuses.filter((s) =>
        Object.values(RideStatus).includes(s as RideStatus),
      );
      if (validStatuses.length > 0) {
        where.status = { in: validStatuses };
      }
    }

    // Driver filter
    if (dto.driverId) {
      where.driverProfileId = dto.driverId;
    }

    // Text search (ride ID or payment external ID)
    if (dto.q) {
      where.OR = [
        { id: { startsWith: dto.q } },
        {
          payment: {
            externalPaymentId: { startsWith: dto.q },
          },
        },
      ];
    }

    // Payment filters
    const paymentWhere: any = {};

    if (dto.paymentStatus) {
      const statuses = dto.paymentStatus.split(',').map((s) => s.trim());
      const validStatuses = statuses.filter((s) =>
        Object.values(PaymentStatus).includes(s as PaymentStatus),
      );
      if (validStatuses.length > 0) {
        paymentWhere.status = { in: validStatuses };
      }
    }

    if (dto.provider) {
      const providers = dto.provider.split(',').map((p) => p.trim());
      const validProviders = providers.filter((p) =>
        Object.values(PaymentProvider).includes(p as PaymentProvider),
      );
      if (validProviders.length > 0) {
        paymentWhere.provider = { in: validProviders };
      }
    }

    // Note: PaymentMethod is not stored directly in Payment model
    // It's derived from provider (CASH -> CASH, VIVA -> CARD)
    // We handle this through the provider filter

    if (Object.keys(paymentWhere).length > 0) {
      where.payment = paymentWhere;
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause
   */
  private buildOrderBy(sortBy: RideSortField, sortDir: 'asc' | 'desc'): any {
    const orderBy: any = [
      { [sortBy]: sortDir },
      { id: sortDir }, // Secondary sort for stable ordering
    ];
    return orderBy;
  }

  /**
   * Build cursor where clause for pagination
   */
  private buildCursorWhere(
    sortBy: RideSortField,
    sortDir: 'asc' | 'desc',
    cursorDir: 'next' | 'prev',
    cursorData: CursorData,
  ): any {
    const { sortValue, id } = cursorData;

    // Determine comparison operator based on direction
    let comparison: 'gt' | 'lt' | 'gte' | 'lte';

    if (cursorDir === 'next') {
      comparison = sortDir === 'asc' ? 'gt' : 'lt';
    } else {
      comparison = sortDir === 'asc' ? 'lt' : 'gt';
    }

    // Convert sortValue to appropriate type
    let typedSortValue: any = sortValue;
    if (sortBy === 'startedAt') {
      typedSortValue = new Date(sortValue as string);
    } else if (['fareTotal', 'durationMin', 'distanceKm'].includes(sortBy)) {
      typedSortValue = new Decimal(sortValue as number);
    }

    // Build composite cursor condition
    // WHERE (sortField, id) > (cursorSortValue, cursorId)
    // This handles NULL values and ensures stable pagination
    return {
      OR: [
        {
          [sortBy]: { [comparison]: typedSortValue },
        },
        {
          [sortBy]: typedSortValue,
          id: { [comparison]: id },
        },
      ],
    };
  }

  /**
   * Generate pagination cursors for next/prev navigation
   */
  private generatePageInfo(
    rides: any[],
    sortBy: RideSortField,
    hasMore: boolean,
    currentDir: 'next' | 'prev',
    limit: number,
  ): PageInfoDto {
    if (rides.length === 0) {
      return {
        limit,
        nextCursor: null,
        prevCursor: null,
      };
    }

    const lastRide = rides[rides.length - 1];
    const firstRide = rides[0];

    // Generate cursors
    const nextCursor = hasMore ? this.encodeCursor(lastRide, sortBy) : null;
    const prevCursor =
      currentDir === 'next' ? this.encodeCursor(firstRide, sortBy) : null;

    return {
      limit,
      nextCursor,
      prevCursor,
    };
  }

  /**
   * Encode cursor from ride data
   */
  private encodeCursor(ride: any, sortBy: RideSortField): string {
    let sortValue: string | number;

    if (sortBy === 'startedAt') {
      sortValue = ride.startedAt.toISOString();
    } else if (sortBy === 'fareTotal') {
      sortValue = ride.fareTotal?.toString() || '0';
    } else if (sortBy === 'durationMin') {
      sortValue = ride.durationMin?.toString() || '0';
    } else if (sortBy === 'distanceKm') {
      sortValue = ride.distanceKm?.toString() || '0';
    } else {
      sortValue = ride.startedAt.toISOString();
    }

    const cursorData: CursorData = {
      sortValue,
      id: ride.id,
    };

    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  /**
   * Calculate summary aggregates for the filtered rides
   */
  private async calculateSummary(where: any): Promise<RideSummaryDto> {
    // Execute all aggregations in parallel
    const [totalRides, statusCounts, fareAndTaxAgg, paymentCounts] =
      await Promise.all([
        // Total rides count
        this.prisma.ride.count({ where }),

        // Status counts
        this.prisma.ride.groupBy({
          by: ['status'],
          where,
          _count: { status: true },
        }),

        // Fare and tax aggregate (all rides, not just COMPLETED)
        this.prisma.ride.aggregate({
          where,
          _sum: { fareTotal: true, taxAmount: true, fareSubtotal: true },
        }),

        // Payment status counts
        this.prisma.payment.groupBy({
          by: ['status'],
          where: {
            ride: where,
          },
          _count: { status: true },
        }),
      ]);

    // Extract status counts
    const statusMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Extract payment counts
    const paymentMap = paymentCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      ridesCount: totalRides,
      totalFare: fareAndTaxAgg._sum.fareTotal?.toString() || '0',
      totalTax: fareAndTaxAgg._sum.taxAmount?.toString() || '0',
      fareSubtotal: fareAndTaxAgg._sum.fareSubtotal?.toString() || '0',
      byStatus: {
        COMPLETED: statusMap[RideStatus.COMPLETED] || 0,
        CANCELLED: statusMap[RideStatus.CANCELLED] || 0,
        ONGOING: statusMap[RideStatus.ONGOING] || 0,
        DRAFT: statusMap[RideStatus.DRAFT] || 0,
      },
      byPaymentStatus: {
        PAID: paymentMap[PaymentStatus.PAID] || 0,
        PENDING: paymentMap[PaymentStatus.PENDING] || 0,
        FAILED: paymentMap[PaymentStatus.FAILED] || 0,
        REQUIRES_ACTION: paymentMap[PaymentStatus.REQUIRES_ACTION] || 0,
        REFUNDED: paymentMap[PaymentStatus.REFUNDED] || 0,
      },
    };
  }

  /**
   * Map payment provider to payment method
   * CASH -> CASH, VIVA -> CARD
   */
  private getPaymentMethod(provider: PaymentProvider): 'CASH' | 'CARD' {
    return provider === PaymentProvider.CASH ? 'CASH' : 'CARD';
  }

  /**
   * Mask external payment ID for security
   * Example: "tx_1234567890" -> "tx_****7890"
   */
  private maskExternalPaymentId(externalId: string | null): string | null {
    if (!externalId) return null;

    // If too short to mask meaningfully, return as-is
    if (externalId.length <= 8) return externalId;

    // Show first 3 and last 4 characters, mask the middle
    const prefix = externalId.slice(0, 3);
    const suffix = externalId.slice(-4);
    return `${prefix}****${suffix}`;
  }

  /**
   * Generate server-side flags for problem detection
   * Rules:
   * - PAYMENT_FAILED: payment.status === FAILED
   * - PAYMENT_PENDING: payment.status === PENDING
   * - MISSING_PAYMENT: ride.status === COMPLETED && !payment
   * - MISSING_ENDED_AT: ride.status === COMPLETED && !endedAt
   * - FARE_ZERO: fareTotal === 0 or null
   */
  private generateFlags(ride: any): RideFlag[] {
    const flags: RideFlag[] = [];

    // Payment-related flags
    if (ride.payment) {
      if (ride.payment.status === PaymentStatus.FAILED) {
        flags.push('PAYMENT_FAILED');
      }
      if (ride.payment.status === PaymentStatus.PENDING) {
        flags.push('PAYMENT_PENDING');
      }
    } else if (ride.status === RideStatus.COMPLETED) {
      flags.push('MISSING_PAYMENT');
    }

    // Ride data integrity flags
    if (ride.status === RideStatus.COMPLETED && !ride.endedAt) {
      flags.push('MISSING_ENDED_AT');
    }

    // Fare validation
    if (!ride.fareTotal || new Decimal(ride.fareTotal).equals(0)) {
      flags.push('FARE_ZERO');
    }

    return flags;
  }
}
