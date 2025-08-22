import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum RideStatusFilter {
  DRAFT = 'DRAFT',
  ONGOING = 'ONGOING', 
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ALL = 'ALL'
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

  @ApiPropertyOptional({ enum: RideStatusFilter, default: RideStatusFilter.ALL })
  @IsOptional()
  @IsEnum(RideStatusFilter)
  status?: RideStatusFilter;

  @ApiPropertyOptional({ description: 'Filter by driver profile ID' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

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

export interface RideResponseDto {
  id: string;
  tenantId: string;
  driverProfileId: string;
  startedAt: string;
  endedAt?: string;
  durationMin?: string;
  distanceKm?: string;
  fareSubtotal?: string;
  taxAmount?: string;
  fareTotal?: string;
  status: string;
  createdAt: string;
}

export interface RidesPageResponse {
  items: RideResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}
