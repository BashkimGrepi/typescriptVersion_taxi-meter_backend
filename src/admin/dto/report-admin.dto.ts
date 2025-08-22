import { IsOptional, IsString, IsUUID, Min, Max, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ReportsQueryDto {
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
    description: 'Filter by driver profile ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: false
  })
  @IsOptional()
  @IsUUID(4, { message: 'Driver ID must be a valid UUID' })
  driverId?: string;

  @ApiProperty({
    description: 'Report granularity',
    example: 'daily',
    enum: ['daily', 'weekly', 'monthly'],
    required: false,
    default: 'daily'
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'], {
    message: 'Granularity must be one of: daily, weekly, monthly'
  })
  granularity?: string = 'daily';
}

export class RevenueReportItem {
  @ApiProperty({ description: 'Period label', example: '2024-01-15' })
  period: string;

  @ApiProperty({ description: 'Number of rides', example: 45 })
  rideCount: number;

  @ApiProperty({ description: 'Total revenue', example: '1250.50' })
  totalRevenue: string;

  @ApiProperty({ description: 'Average fare per ride', example: '27.79' })
  avgFarePerRide: string;

  @ApiProperty({ description: 'Total distance in kilometers', example: '423.5' })
  totalDistanceKm: string;

  @ApiProperty({ description: 'Total duration in minutes', example: '720.25' })
  totalDurationMin: string;
}

export class RevenueReportResponse {
  @ApiProperty({ description: 'Report period', example: 'Last 30 days' })
  period: string;

  @ApiProperty({
    description: 'Revenue data by time period',
    type: [RevenueReportItem]
  })
  data: RevenueReportItem[];

  @ApiProperty({
    description: 'Summary statistics',
    type: 'object',
    properties: {
      totalRides: { type: 'number', example: 450 },
      totalRevenue: { type: 'string', example: '12505.75' },
      avgRevenuePerDay: { type: 'string', example: '416.86' },
      avgFarePerRide: { type: 'string', example: '27.79' },
      totalDistanceKm: { type: 'string', example: '4235.8' },
      totalDurationHours: { type: 'string', example: '120.04' }
    }
  })
  summary: {
    totalRides: number;
    totalRevenue: string;
    avgRevenuePerDay: string;
    avgFarePerRide: string;
    totalDistanceKm: string;
    totalDurationHours: string;
  };
}

export class DriverPerformanceItem {
  @ApiProperty({ description: 'Driver profile ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  driverProfileId: string;

  @ApiProperty({ description: 'Driver first name', example: 'John' })
  firstName: string;

  @ApiProperty({ description: 'Driver last name', example: 'Doe' })
  lastName: string;

  @ApiProperty({ description: 'Number of rides', example: 45 })
  rideCount: number;

  @ApiProperty({ description: 'Total revenue generated', example: '1250.50' })
  totalRevenue: string;

  @ApiProperty({ description: 'Average fare per ride', example: '27.79' })
  avgFarePerRide: string;

  @ApiProperty({ description: 'Total distance driven in km', example: '423.5' })
  totalDistanceKm: string;

  @ApiProperty({ description: 'Total driving time in hours', example: '32.25' })
  totalDurationHours: string;

  @ApiProperty({ description: 'Average rides per day', example: '1.5' })
  avgRidesPerDay: string;
}

export class DriverPerformanceResponse {
  @ApiProperty({ description: 'Report period', example: 'Last 30 days' })
  period: string;

  @ApiProperty({
    description: 'Driver performance data',
    type: [DriverPerformanceItem]
  })
  drivers: DriverPerformanceItem[];

  @ApiProperty({
    description: 'Fleet summary',
    type: 'object',
    properties: {
      totalDrivers: { type: 'number', example: 15 },
      activeDrivers: { type: 'number', example: 12 },
      totalRides: { type: 'number', example: 540 },
      totalRevenue: { type: 'string', example: '15006.25' },
      avgRidesPerDriver: { type: 'string', example: '45.0' },
      avgRevenuePerDriver: { type: 'string', example: '1250.52' }
    }
  })
  fleetSummary: {
    totalDrivers: number;
    activeDrivers: number;
    totalRides: number;
    totalRevenue: string;
    avgRidesPerDriver: string;
    avgRevenuePerDriver: string;
  };
}

export class PaymentMethodReportItem {
  @ApiProperty({ description: 'Payment method/provider', example: 'STRIPE' })
  paymentMethod: string;

  @ApiProperty({ description: 'Number of payments', example: 125 })
  paymentCount: number;

  @ApiProperty({ description: 'Total amount', example: '3450.75' })
  totalAmount: string;

  @ApiProperty({ description: 'Percentage of total payments', example: '65.5' })
  percentage: number;
}

export class PaymentMethodReportResponse {
  @ApiProperty({ description: 'Report period', example: 'Last 30 days' })
  period: string;

  @ApiProperty({
    description: 'Payment method breakdown',
    type: [PaymentMethodReportItem]
  })
  paymentMethods: PaymentMethodReportItem[];

  @ApiProperty({
    description: 'Payment summary',
    type: 'object',
    properties: {
      totalPayments: { type: 'number', example: 190 },
      totalAmount: { type: 'string', example: '5267.25' },
      avgPaymentAmount: { type: 'string', example: '27.72' },
      paymentRate: { type: 'string', example: '95.5' }
    }
  })
  summary: {
    totalPayments: number;
    totalAmount: string;
    avgPaymentAmount: string;
    paymentRate: string; // percentage of rides with payments
  };
}
