import { IsOptional, IsString, IsUUID, IsDecimal, Min, Max, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Ride ID associated with this payment',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  })
  @IsUUID(4, { message: 'Ride ID must be a valid UUID' })
  rideId: string;

  @ApiProperty({
    description: 'Payment amount',
    example: '25.50',
    type: 'string'
  })
  @IsString()
  @Transform(({ value }) => value?.toString())
  amount: string;

  @ApiProperty({
    description: 'Payment method used - maps to STRIPE (card) or VIVA (cash) provider',
    example: 'card',
    enum: ['cash', 'card']
  })
  @IsIn(['cash', 'card'], {
    message: 'Payment method must be one of: cash, card'
  })
  paymentMethod: string;

  @ApiProperty({
    description: 'Additional notes about the payment',
    example: 'Customer paid exact change',
    required: false
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePaymentDto {
  @ApiProperty({
    description: 'Payment amount',
    example: '25.50',
    type: 'string',
    required: false
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toString())
  amount?: string;

  @ApiProperty({
    description: 'Payment method used',
    example: 'card',
    enum: ['cash', 'card'],
    required: false
  })
  @IsOptional()
  @IsIn(['cash', 'card'], {
    message: 'Payment method must be one of: cash, card'
  })
  paymentMethod?: string;

  @ApiProperty({
    description: 'Additional notes about the payment',
    example: 'Customer paid exact change',
    required: false
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PaymentsQueryDto {
  @ApiProperty({
    description: 'Start date filter (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
    required: false
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({
    description: 'End date filter (ISO string)', 
    example: '2024-12-31T23:59:59.999Z',
    required: false
  })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({
    description: 'Filter by payment method',
    example: 'card',
    enum: ['cash', 'card'],
    required: false
  })
  @IsOptional()
  @IsIn(['cash', 'card'], {
    message: 'Payment method must be one of: cash, card'
  })
  paymentMethod?: string;

  @ApiProperty({
    description: 'Filter by driver profile ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: false
  })
  @IsOptional()
  @IsUUID(4, { message: 'Driver ID must be a valid UUID' })
  driverId?: string;

  @ApiProperty({
    description: 'Minimum payment amount filter',
    example: '10.00',
    required: false
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toString())
  minAmount?: string;

  @ApiProperty({
    description: 'Maximum payment amount filter',
    example: '100.00',
    required: false
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toString())
  maxAmount?: string;

  @ApiProperty({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 25,
    default: 25,
    minimum: 1,
    maximum: 100,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'Page size must be at least 1' })
  @Max(100, { message: 'Page size cannot exceed 100' })
  pageSize?: number = 25;
}

export class PaymentResponseDto {
  @ApiProperty({ description: 'Payment ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ description: 'Tenant ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  tenantId: string;

  @ApiProperty({ description: 'Ride ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  rideId: string;

  @ApiProperty({ description: 'Payment amount', example: '25.50' })
  amount: string;

  @ApiProperty({ description: 'Payment method/provider', example: 'STRIPE' })
  paymentMethod: string;

  @ApiProperty({ description: 'Payment notes', example: 'Customer paid exact change', required: false })
  notes?: string;

  @ApiProperty({ description: 'Payment creation timestamp', example: '2024-01-15T14:30:00.000Z' })
  createdAt: string;
}

export class PaymentsPageResponse {
  @ApiProperty({
    description: 'List of payments',
    type: [PaymentResponseDto]
  })
  items: PaymentResponseDto[];

  @ApiProperty({ description: 'Total number of payments', example: 150 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 25 })
  pageSize: number;

  @ApiProperty({ description: 'Total pages', example: 6 })
  totalPages: number;
}

