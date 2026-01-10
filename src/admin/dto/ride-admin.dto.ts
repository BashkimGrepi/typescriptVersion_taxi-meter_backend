import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentProvider,
  PaymentStatus,
  Ride,
  RidePricingMode,
  RideStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export enum RideStatusFilter {
  DRAFT = 'DRAFT',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ALL = 'ALL',
}

export class RidesQueryDto {
  @ApiPropertyOptional({ description: 'Start date filter (ISO string)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO string)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: RideStatusFilter,
    default: RideStatusFilter.ALL,
  })
  @IsOptional()
  @IsEnum(RideStatusFilter)
  status?: RideStatusFilter;

  @ApiPropertyOptional({ description: 'Filter by driver profile ID' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Filter by driver name (partial match)' })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Filter by payment status',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    enum: PaymentProvider,
    description: 'Filter by payment provider/method',
  })
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;
}

export interface RideListItemDto {
  rideId: string;
  driverName: string;
  date: string; // startedAt ISO string
  rideStatus: RideStatus;
  paymentStatus: PaymentStatus | null;
  paymentMethod: PaymentProvider | null;
  amount: string | null; // fareTotal as string
}

export interface RidePageResponse {
  items: RideListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RideSummaryResponseDto {
  ride: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationMin: string | null;
    distanceKm: string | null;
    faresubtotal: Decimal | null;
    taxAmount: Decimal | null;
    fareTotal: Decimal | null;
    status: RideStatus;
    pricingMode: RidePricingMode;
  },
  driver: {
    id: string;
    firstName: string;
    lastName: string;
  },
  tenant: {
    id: string;
    tenantName: string;
  },
  payment: {
    id: string;
    provider: PaymentProvider;
    amount: Decimal;
    currency: string;
    status: PaymentStatus;
    
  }

}
