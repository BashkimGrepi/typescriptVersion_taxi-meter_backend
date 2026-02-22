import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsUUID,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentProvider,
  PaymentStatus,
  RideStatus,
} from '@prisma/client';

// Sorting options
export type RideSortField =
  | 'startedAt'
  | 'fareTotal'
  | 'durationMin'
  | 'distanceKm';
export type SortDirection = 'asc' | 'desc';
export type CursorDirection = 'next' | 'prev';

/**
 * Query DTO for GET /api/admin/rides
 * Supports comprehensive filtering, sorting, and cursor-based pagination
 */
export class GetRidesQueryDto {
  // Time range filters
  @ApiPropertyOptional({
    description: 'Start date filter (ISO string, inclusive)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date filter (ISO string, exclusive)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  // Status filter (comma-separated)
  @ApiPropertyOptional({
    description: 'Comma-separated ride statuses',
    example: 'COMPLETED,CANCELLED',
  })
  @IsOptional()
  @IsString()
  status?: string;

  // Driver filter
  @ApiPropertyOptional({ description: 'Filter by driver profile ID' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  // Payment status filter (comma-separated)
  @ApiPropertyOptional({
    description: 'Comma-separated payment statuses',
    example: 'PAID,PENDING',
  })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  // Payment provider filter (comma-separated)
  @ApiPropertyOptional({
    description: 'Comma-separated payment providers',
    example: 'STRIPE,VIVA',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  // Payment method filter (comma-separated)
  @ApiPropertyOptional({
    description: 'Comma-separated payment methods',
    example: 'CASH,CARD',
  })
  @IsOptional()
  @IsString()
  method?: string;

  // Text search
  @ApiPropertyOptional({
    description: 'Search by ride ID prefix or payment external ID prefix',
  })
  @IsOptional()
  @IsString()
  q?: string;

  // Sorting
  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['startedAt', 'fareTotal', 'durationMin', 'distanceKm'],
    default: 'startedAt',
  })
  @IsOptional()
  @IsIn(['startedAt', 'fareTotal', 'durationMin', 'distanceKm'])
  sortBy?: RideSortField;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: SortDirection;

  // Pagination
  @ApiPropertyOptional({
    description: 'Number of items to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination (base64-encoded position marker). See docs/CURSOR_PAGINATION_EXPLAINED.md for details.',
    example: 'eyJzb3J0VmFsdWUiOiIyMDI2LTAyLTEzVDA5OjEyOjAwWiIsImlkIjoidXVpZCJ9'
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Cursor direction',
    enum: ['next', 'prev'],
    default: 'next',
  })
  @IsOptional()
  @IsIn(['next', 'prev'])
  cursorDir?: CursorDirection;
}

/**
 * Ride flags for problem detection
 */
export type RideFlag =
  | 'PAYMENT_FAILED'
  | 'PAYMENT_PENDING'
  | 'MISSING_PAYMENT'
  | 'MISSING_ENDED_AT'
  | 'FARE_ZERO';

/**
 * Single ride row in the paginated list
 */
export interface RideRowDto {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: RideStatus;
  driver: {
    id: string;
    name: string; // Combined firstName + lastName
  };
  durationMin: string | null;
  distanceKm: string | null;
    fareTotal: string | null;
    taxAmount: string | null;
    fareSubtotal: string | null;
  currency: string; // "EUR" or from payment
  payment: {
    status: PaymentStatus;
    provider: PaymentProvider;
    method: 'CASH' | 'CARD';
    externalPaymentIdMasked: string | null; // Server-side masked
  } | null;
  flags: RideFlag[]; // Server-generated problem indicators
}

/**
 * Summary aggregates for the filtered rides
 */
export interface RideSummaryDto {
  ridesCount: number;
  totalFare: string; // Sum of fareTotal
    totalTax: string; // Sum of taxAmount
    fareSubtotal: string; // Sum of fareSubtotal
  byStatus: {
    COMPLETED: number;
    CANCELLED: number;
    ONGOING: number;
    DRAFT: number;
  };
  byPaymentStatus: {
    PAID: number;
    PENDING: number;
    FAILED: number;
    REQUIRES_ACTION: number;
    REFUNDED: number;
  };
}

/**
 * Pagination cursor information
 */
export interface PageInfoDto {
  limit: number;
  nextCursor: string | null;
  prevCursor: string | null;
}

/**
 * Complete response for GET /api/admin/rides
 * Matches spec: AdminRidesListResponse
 */
export interface GetRidesResponseDto {
  data: RideRowDto[];
  page: PageInfoDto;
  summary: RideSummaryDto;
}

// ============================================
// Ride Detail Endpoint DTOs
// ============================================

/**
 * Response DTO for GET /api/admin/rides/:rideId
 * Returns full ride details for admin audit/review
 */
export interface RideDetailResponseDto {
  id: string;
  status: RideStatus;
  startedAt: string;
  endedAt: string | null;
  durationMin: string | null;
  distanceKm: string | null;
  fareSubtotal: string | null;
  taxAmount: string | null;
  fareTotal: string | null;
  currency: string; // "EUR" or from payment
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string;
  };
  pricingPolicy: {
    id: string;
    name: string;
    baseFare: string;
    perMinute: string;
    perKm: string;
    createdAt: string;
  } | null;
  payment: {
    id: string;
    provider: PaymentProvider;
    status: PaymentStatus;
    method: 'CASH' | 'CARD';
    amount: string;
    currency: string;
    authorizedAt: string | null;
    capturedAt: string | null;
    failureCode: string | null;
    externalPaymentId: string | null; // Full ID (not masked) for admin audit
  } | null;
}
