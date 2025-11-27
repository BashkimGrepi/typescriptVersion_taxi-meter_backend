import {
  IsOptional,
  IsString,
  IsEnum,
  IsEmail,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DriverStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ALL = 'ALL',
}

export class CreateDriverDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: '+358401234567' })
  @IsOptional()
  @IsString()
  phone: string;

  @IsString()
  @IsEmail()
  email: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+358401234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ['INVITED', 'ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsEnum(['INVITED', 'ACTIVE', 'INACTIVE'])
  status?: 'INVITED' | 'ACTIVE' | 'INACTIVE';
}

export class DriversQueryDto {
  @ApiPropertyOptional({
    description: 'Search term for firstName, lastName, phone',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: DriverStatus, default: DriverStatus.ALL })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

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

export interface DriverResponseDto {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userId: string;
  status: string;
  createdAt: string;
}

export interface DriversPageResponse {
  items: DriverResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}
