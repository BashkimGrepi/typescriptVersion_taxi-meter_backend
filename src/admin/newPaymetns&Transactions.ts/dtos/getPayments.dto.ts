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
import { PaymentProvider, PaymentStatus, RideStatus } from '@prisma/client';

// Sorting options for payments
export type PaymentSortField = 'createdAt' | 'capturedAt' | 'amount';
export type SortDirection = 'asc' | 'desc';
export type CursorDirection = 'next' | 'prev';

/**
 * Query DTO for GET /api/admin/payments-transactions/payments
 * Supports filtering, sorting, and cursor-based pagination
 */
export class GetPaymentsQueryDto {
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
    description: 'Comma-separated payment statuses',
    example: 'PAID,PENDING,FAILED',
  })
  @IsOptional()
  @IsString()
  status?: string;

  // Provider filter (comma-separated)
  @ApiPropertyOptional({
    description: 'Comma-separated payment providers',
    example: 'VIVA,STRIPE,CASH',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  // Driver filter
  @ApiPropertyOptional({ description: 'Filter by driver profile ID' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  // Ride filter
  @ApiPropertyOptional({ description: 'Filter by ride ID' })
  @IsOptional()
  @IsUUID()
  rideId?: string;

  // Text search
  @ApiPropertyOptional({
    description:
      'Search by payment ID, externalPaymentId, invoiceNumber, or receiptNumber prefix',
  })
  @IsOptional()
  @IsString()
  q?: string;

  // Sorting
  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'capturedAt', 'amount'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'capturedAt', 'amount'])
  sortBy?: PaymentSortField;

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
    description:
      'Opaque cursor for pagination (base64-encoded position marker)',
    example: 'eyJzb3J0VmFsdWUiOiIyMDI2LTAyLTEzVDA5OjEyOjAwWiIsImlkIjoidXVpZCJ9',
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
 * Payment flags for problem detection
 */
export type PaymentFlag =
  | 'REFUND_NEEDED' // Payment was refunded
  | 'REQUIRES_ACTION' // Payment requires additional action
  | 'FAILED' // Payment failed
  | 'LONG_PENDING' // Payment pending for too long (>24 hours)
  | 'MISSING_CAPTURE' // Payment authorized but not captured (>24 hours)
  | 'MISSING_INVOICE' // Payment complete but no invoice number
  | 'MISSING_RECEIPT'; // Payment complete but no receipt number

/**
 * Single payment row data
 */
export interface PaymentRowDto {
  id: string;
  status: PaymentStatus;
  provider: PaymentProvider;

  // Amounts
  amount: string;
  taxAmount: string | null;
  netAmount: string | null;
  currency: string;

  // Timestamps
  createdAt: string;
  capturedAt: string | null;
  authorizedAt: string | null;

  // References
  externalPaymentId: string | null;
  invoiceNumber: string | null;
  receiptNumber: string | null;
  approvalCode: string | null;
  failureCode: string | null;

  // Ride data
  ride: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    status: RideStatus;
    fareTotal: string;
    distanceKm: number;
    durationMin: number | null;
    driverProfile: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };

  // Flags for quick filtering
  flags: PaymentFlag[];
}

/**
 * Pagination metadata
 */
export interface PageInfoDto {
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  totalInPage: number;
}

/**
 * Main response DTO
 */
export interface GetPaymentsResponseDto {
  payments: PaymentRowDto[];
  page: PageInfoDto;
}
