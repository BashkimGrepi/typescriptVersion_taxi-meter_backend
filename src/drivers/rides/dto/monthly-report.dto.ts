import { IsOptional, IsUUID, Matches } from 'class-validator';

/**
 * Query for monthly reports.
 * Example: GET /admin/reports/rides?month=2025-08&driverId=...
 */
export class MonthlyReportQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be YYYY-MM',
  })
  month!: string;

  @IsOptional()
  @IsUUID('4')
  driverId?: string; // filter to one driver (optional)
}

/** Totals for the whole month (tenant scope or driver-filtered) */
export class MonthlyTotalsDto {
  ridesCount!: number;
  totalDurationMin!: number; // sum of durationMin
  totalDistanceKm!: string;  // Decimal -> string
  subtotal!: string;         // sum fareSubtotal
  tax!: string;              // sum taxAmount
  total!: string;            // sum fareTotal
}

/** Per-driver summary row for the month */
export class DriverMonthlySummaryDto {
  driverProfileId!: string;
  ridesCount!: number;
  totalDistanceKm!: string;
  totalDurationMin!: number;
  revenueTotal!: string; // sum of fareTotal
}

/** Optional: a lightweight row for listing completed rides in that month */
export class RideRowDto {
  rideId!: string;
  driverProfileId!: string;
  startedAt!: string;
  endedAt!: string;
  distanceKm!: number;
  durationMinutes!: number;
  fareTotal!: string;
}

/** Response shape for the monthly report endpoint */
export class MonthlyReportDto {
  month!: string;        // YYYY-MM
  tenantId!: string;
  totals!: MonthlyTotalsDto;
  perDriver!: DriverMonthlySummaryDto[];
  rides?: RideRowDto[];  // include if endpoint returns the underlying rows
}
