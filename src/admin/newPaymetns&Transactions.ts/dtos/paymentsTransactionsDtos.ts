import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export interface GetPaymentsTransactionsResponse {
  period: {
    from: string;
    to: string;
  };
  fareSubtotal: string;
  taxAmount: string;
  fareTotal: string;
  comparison?: string;
  amounts: {
    byProvider: {
      provider: PaymentProvider;
      totalAmount: string;
      netAmount: string;
      taxAmount: string;
    }[];
    byStatus: {
      status: PaymentStatus;
      totalAmount: string;
      netAmount: string;
      taxAmount: string;
    }[];
  };
  counts: {
    total: number;
    byProvider: {
      provider: PaymentProvider;
      count: number;
    }[];
    byStatus: {
      status: PaymentStatus;
      count: number;
    }[];
  };
}

export enum ProfitGranularity {
  YEAR = 'year', // Shows last 6 years
  MONTH = 'month', // Shows all 12 months of current year
  WEEK = 'week', // Shows all weeks of current month
  DAY = 'day', // Shows all days of current week
}

export class GetProfitTimelineQueryDto {
  @ApiPropertyOptional({
    enum: ProfitGranularity,
    description:
      'Time granularity: year shows last 6 years, month shows 12 months of current year, week shows weeks of current month, day shows 7 days of current week',
    example: 'month',
  })
  @IsEnum(ProfitGranularity)
  @IsOptional()
  granularity?: ProfitGranularity = ProfitGranularity.MONTH;

  @ApiPropertyOptional({
    description:
      'Start date (ISO format). Defaults: year=(current-5 years), month=(Jan 1 of current year), week=(1st of current month), day=(Monday of current week)',
    example: '2023-01-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'End date (ISO format). Defaults: year=(Dec 31 of current year), month=(Dec 31 of current year), week=(last day of current month), day=(Sunday of current week)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsOptional()
  toDate?: string;
}

export interface ProfitChartResponse {
  granularity: ProfitGranularity;
  period: {
    from: string;
    to: string;
  };
  data: Array<{
    label: string; // Format: "2023" (year), "2023-01" (month), "2023-W12" (week)
    profit: string;
    timestamp: string; // ISO date for sorting/reference
  }>;
  total: string;
}
