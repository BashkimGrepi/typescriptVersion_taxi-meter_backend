import { IsOptional, IsString, IsUUID, Min, Max, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ReportsQueryDto {
  @ApiProperty({
    description: 'Start date filter (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({
    description: 'End date filter (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({
    description: 'Filter by driver profile ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: false,
  })
  @IsOptional()
  @IsUUID(4, { message: 'Driver ID must be a valid UUID' })
  driverId?: string;

  @ApiProperty({
    description: 'Report granularity',
    example: 'daily',
    enum: ['daily', 'weekly', 'monthly'],
    required: false,
    default: 'daily',
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'], {
    message: 'Granularity must be one of: daily, weekly, monthly',
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

  @ApiProperty({
    description: 'Total distance in kilometers',
    example: '423.5',
  })
  totalDistanceKm: string;

  @ApiProperty({ description: 'Total duration in minutes', example: '720.25' })
  totalDurationMin: string;
}

export class RevenueReportResponse {
  @ApiProperty({ description: 'Report period', example: 'Last 30 days' })
  period: string;

  @ApiProperty({
    description: 'Revenue data by time period',
    type: [RevenueReportItem],
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
      totalDurationHours: { type: 'string', example: '120.04' },
    },
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
  @ApiProperty({
    description: 'Driver profile ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
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
    type: [DriverPerformanceItem],
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
      avgRevenuePerDriver: { type: 'string', example: '1250.52' },
    },
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
    type: [PaymentMethodReportItem],
  })
  paymentMethods: PaymentMethodReportItem[];

  @ApiProperty({
    description: 'Payment summary',
    type: 'object',
    properties: {
      totalPayments: { type: 'number', example: 190 },
      totalAmount: { type: 'string', example: '5267.25' },
      avgPaymentAmount: { type: 'string', example: '27.72' },
      paymentRate: { type: 'string', example: '95.5' },
    },
  })
  summary: {
    totalPayments: number;
    totalAmount: string;
    avgPaymentAmount: string;
    paymentRate: string; // percentage of rides with payments
  };
}

export class PaymentAnalyticsResponse {
  period: string; // "2025-01-01 to 2025-01-31"

  // ═══════════════════════════════════════════════════════
  // 1. OVERALL SUMMARY
  // ═══════════════════════════════════════════════════════
  summary: {
    totalPayments: number; // COUNT(*)
    totalAmount: string; // SUM(amount)
    avgAmount: string; // AVG(amount)
    successfulPayments: number; // COUNT where status = 'PAID'
    failedPayments: number; // COUNT where status = 'FAILED'
    pendingPayments: number; // COUNT where status in ['PENDING', 'REQUIRES_ACTION', 'SUBMITTED']
    refundedPayments: number; // COUNT where status = 'REFUNDED'
    successRate: number; // (successful / total) * 100
    failureRate: number; // (failed / total) * 100
    avgProcessingTime: string; // AVG(capturedAt - authorizedAt) in seconds
  };

  // ═══════════════════════════════════════════════════════
  // 2. BY STATUS - All 6 statuses
  // ═══════════════════════════════════════════════════════
  byStatus: Array<{
    status: string; // PAID, FAILED, PENDING, etc.
    count: number; // COUNT(*) GROUP BY status
    amount: string; // SUM(amount) GROUP BY status
    percentage: number; // (count / total) * 100
  }>;

  // ═══════════════════════════════════════════════════════
  // 3. BY PROVIDER - CASH vs VIVA
  // ═══════════════════════════════════════════════════════
  byProvider: Array<{
    provider: string; // CASH | VIVA
    totalCount: number; // COUNT(*) GROUP BY provider
    totalAmount: string; // SUM(amount) GROUP BY provider
    avgAmount: string; // AVG(amount) GROUP BY provider

    // Status breakdown per provider
    paidCount: number; // COUNT where status='PAID'
    failedCount: number; // COUNT where status='FAILED'
    pendingCount: number; // COUNT where status in pending states
    refundedCount?: number; // COUNT where status='REFUNDED'

    successRate: number; // (paid / total) * 100
    failureRate: number; // (failed / total) * 100

    // Only for VIVA (CASH doesn't have these)
    avgProcessingTime?: string; // AVG(capturedAt - authorizedAt)
    withExternalId: number; // COUNT where externalPaymentId IS NOT NULL
  }>;

  // ═══════════════════════════════════════════════════════
  // 4. FAILURE ANALYSIS - Only for failed payments
  // ═══════════════════════════════════════════════════════
 // failures: {
   // totalFailures: number; // COUNT where status='FAILED'
   // totalFailedAmount: string; // SUM(amount) where status='FAILED'

   // byCode: Array<{
   //   // GROUP BY failureCode
   //   code: string; // failureCode value
   //   count: number; // COUNT(*)
   //   amount: string; // SUM(amount)
   //   percentage: number; // (count / totalFailures) * 100
  //  }>;

  //  byProvider: Array<{
  //    // Failures per provider
  //    provider: string; // CASH | VIVA
  //    failureCount: number; // COUNT where status='FAILED'
  //    failureRate: number; // (failures / provider_total) * 100
  //  }>;
  //};

  // ═══════════════════════════════════════════════════════
  // 5. REFUNDS - Track refunded payments
  // ═══════════════════════════════════════════════════════
  //refunds: {
    //totalRefunds: number; // COUNT where status='REFUNDED'
    //totalRefundedAmount: string; // SUM(amount) where status='REFUNDED'
    //refundRate: number; // (refunds / successful) * 100

    //byProvider: Array<{
      //provider: string;
      //refundCount: number;
      //refundAmount: string;
    //}>;
  ////};

  

}