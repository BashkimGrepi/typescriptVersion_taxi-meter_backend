import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, PaymentStatus, RideStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

/** What each line (payment) will look like for the snapshot/PDF */
export type ExportPaymentRow = {
  paymentId: string;
  receiptNumber: string | null; // assigned in Milestone 2
  capturedAt: string;           // ISO
  serviceDate: string | null;   // ISO (ride.endedAt) — null if no ride
  rate: number;                 // 0.10 or 0.14 based on serviceDate
  base: string;                 // money string "xx.yy" (2 dp)
  tax: string;                  // money string "xx.yy"
  total: string;                // money string "xx.yy"
  currency: string;             // e.g. "EUR"

  // human-readable context (optional but nice)
  description: string;          // "Passenger transport"
  method?: string | null;       // payment method/provider if you store it
  driverName?: string | null;
  vehicleRef?: string | null;

  // traceability
  rideId?: string | null;
  externalPaymentId?: string | null;
};

/** Summary per VAT rate (and optionally per method) */
export type VatRateBucket = {
  rate: number;     // 0.10 or 0.14
  method?: string;  // optional breakdown by method/provider
  count: number;
  base: string;     // 2 dp
  tax: string;      // 2 dp
  total: string;    // 2 dp
};

export type ExportExceptions = {
  ridesWithoutPayments: Array<{ rideId: string; endedAt: string }>;
  paymentsWithoutRide: Array<{ paymentId: string; capturedAt: string }>;
  warnings: string[];
};

@Injectable()
export class ExportDataService {
  constructor(private readonly prisma: PrismaService) {}

  /** WHY: central place to convert any numeric/decimal to money string safely */
  private money(v: Prisma.Decimal | number | null | undefined, dp = 2): string {
    const d = v == null
      ? new Prisma.Decimal(0)
      : v instanceof Prisma.Decimal
      ? v
      : new Prisma.Decimal(v);
    return d.toDP(dp).toString();
  }

  /** VAT rate by service date (ride end). WHY: law changes on 2025-01-01 */
  private vatRateFor(date: Date | null): Prisma.Decimal {
    // If we don't have a service date (no ride), fall back to 14% today.
    if (!date || isNaN(+date)) return new Prisma.Decimal('0.14');
    const cutoff = new Date('2025-01-01T00:00:00Z');
    return new Prisma.Decimal(date < cutoff ? '0.10' : '0.14');
  }

  /**
   * Compute base/tax/total for one payment line.
   * WHY: Prefer amounts already stored on the Ride (your endRide wrote precise values).
   * If those are missing, derive from Payment.amount using the correct VAT rate.
   */
  private computeAmounts(opts: {
    rideSubtotal?: Prisma.Decimal | null;
    rideTax?: Prisma.Decimal | null;
    rideTotal?: Prisma.Decimal | null;
    paymentAmount?: Prisma.Decimal | null;
    rate: Prisma.Decimal;
  }): { base: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal } {
    const { rideSubtotal, rideTax, rideTotal, paymentAmount, rate } = opts;

    if (rideSubtotal != null && rideTax != null && rideTotal != null) {
      // Trust the ride calculations (they’re the source of truth for VAT math).
      return {
        base: new Prisma.Decimal(rideSubtotal),
        tax: new Prisma.Decimal(rideTax),
        total: new Prisma.Decimal(rideTotal),
      };
    }

    // Fallback: derive from Payment.amount (e.g., if ride fields were null for some reason)
    const total = new Prisma.Decimal(paymentAmount ?? 0);
    const divisor = new Prisma.Decimal(1).add(rate); // 1 + 0.10 or 0.14
    const base = total.div(divisor);
    const tax = total.sub(base);
    return { base, tax, total };
  }

  /**
   * Load the dataset for the export (PAID payments in range), compute VAT, and prepare exceptions & summary.
   * WHY: This is the single place your endpoint will call before building JSON/PDF.
   */
  async loadPaymentsDataset(tenantId: string, from: Date, to: Date): Promise<{
    rows: ExportPaymentRow[];
    summaryByRate: VatRateBucket[];             // rate-only buckets
    summaryByRateAndMethod: VatRateBucket[];    // optional extra breakdown
    exceptions: ExportExceptions;
  }> {
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || +from >= +to) {
      throw new BadRequestException('Invalid date range');
    }

    // 1) Pull PAID payments for the tenant in [from, to)
    // Select only what we need. Adjust field names to your schema if they differ.
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        status: PaymentStatus.PAID,
        capturedAt: { gte: from, lt: to },
      },
      select: {
        id: true,
        tenantId: true,
        capturedAt: true,
        amount: true,                  // Prisma.Decimal
        currency: true,
        receiptNumber: true,
        numberPeriod: true,

        // If you store method/provider/terminal in Payment (optional)
        externalPaymentId: true as any,

        // Join Ride to get service date & amounts
        ride: {
          select: {
            id: true,
            endedAt: true,
            fareSubtotal: true,
            taxAmount: true,
            fareTotal: true,
            driverProfile: {
              select: { firstName: true, lastName: true },
            },
            // If you have vehicle relation:
            // vehicle: { select: { plate: true, internalRef: true } }
          },
        },
      },
      orderBy: [{ capturedAt: 'asc' }, { id: 'asc' }],
    });

    // 2) Build the main rows with VAT math
    const rows: ExportPaymentRow[] = [];
    const warnings: string[] = [];

    // accumulators for summary (high precision using Decimal)
    const sumByRate: Record<string, { count: number; base: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal }> = {};
    const sumByRateAndMethod: Record<string, { count: number; base: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal }> = {};

    for (const p of payments) {
      const ride = p.ride ?? null;
      const serviceDate = ride?.endedAt ? new Date(ride.endedAt) : null;
      const rate = this.vatRateFor(serviceDate); // Decimal 0.10 or 0.14

      const amounts = this.computeAmounts({
        rideSubtotal: ride?.fareSubtotal ?? null,
        rideTax: ride?.taxAmount ?? null,
        rideTotal: ride?.fareTotal ?? null,
        paymentAmount: p.amount ?? null,
        rate,
      });

      // Optional reconciliation warning if payment.amount ≠ ride.fareTotal
      if (ride?.fareTotal && p.amount && !p.amount.eq(ride.fareTotal)) {
        const delta = p.amount.sub(ride.fareTotal).abs();
        if (delta.greaterThan(new Prisma.Decimal('0.01'))) {
          warnings.push(`Payment ${p.id} amount (${p.amount}) differs from ride total (${ride.fareTotal}) by ${delta}.`);
        }
      }

      const driverName =
        ride?.driverProfile
          ? [ride.driverProfile.firstName, ride.driverProfile.lastName].filter(Boolean).join(' ')
          : null;

      // If you store payment method/provider, prefer a stable string like 'CARD', 'CASH', 'VIVA'
      const method = (p as any).method ?? (p as any).provider ?? null;

      // Push line (string money for presentation)
      rows.push({
        paymentId: p.id,
        receiptNumber: p.receiptNumber,
        capturedAt: p.capturedAt ? new Date(p.capturedAt).toISOString() : '',
        serviceDate: serviceDate ? serviceDate.toISOString() : null,
        rate: Number(rate.toString()),
        base: this.money(amounts.base, 2),
        tax: this.money(amounts.tax, 2),
        total: this.money(amounts.total, 2),
        currency: p.currency ?? 'EUR',
        description: 'Passenger transport',
        method,
        driverName,
        rideId: ride?.id ?? null,
        externalPaymentId: (p as any).externalPaymentId ?? null,
      });

      // Accumulate summary by rate
      const keyRate = rate.toString(); // "0.10" or "0.14"
      if (!sumByRate[keyRate]) {
        sumByRate[keyRate] = {
          count: 0,
          base: new Prisma.Decimal(0),
          tax: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        };
      }
      sumByRate[keyRate].count += 1;
      sumByRate[keyRate].base = sumByRate[keyRate].base.add(amounts.base);
      sumByRate[keyRate].tax = sumByRate[keyRate].tax.add(amounts.tax);
      sumByRate[keyRate].total = sumByRate[keyRate].total.add(amounts.total);

      // Accumulate summary by rate+method (optional breakdown)
      const keyRM = `${keyRate}|${method ?? 'UNKNOWN'}`;
      if (!sumByRateAndMethod[keyRM]) {
        sumByRateAndMethod[keyRM] = {
          count: 0,
          base: new Prisma.Decimal(0),
          tax: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        };
      }
      sumByRateAndMethod[keyRM].count += 1;
      sumByRateAndMethod[keyRM].base = sumByRateAndMethod[keyRM].base.add(amounts.base);
      sumByRateAndMethod[keyRM].tax = sumByRateAndMethod[keyRM].tax.add(amounts.tax);
      sumByRateAndMethod[keyRM].total = sumByRateAndMethod[keyRM].total.add(amounts.total);
    }

    // 3) Exceptions
    // A) Rides without PAID payments (COMPLETED in window but no linked PAID payment)
    //    WHY: helps you spot cash-only or missed capture.
    const ridesWithoutPayments = await this.prisma.ride.findMany({
      where: {
        tenantId,
        status: RideStatus.COMPLETED,
        endedAt: { gte: from, lt: to },
        OR: [
          { payment: { is: null } }, // No payment record at all
          { payment: { status: { not: PaymentStatus.PAID } } }, // Payment exists but not PAID
        ],
      },
      select: { id: true, endedAt: true },
      orderBy: [{ endedAt: 'asc' }],
    });

    // B) Payments without a ride (data issue or manual entry)
    const paymentsWithoutRide = payments
      .filter(p => !p.ride)
      .map(p => ({ 
        paymentId: p.id, 
        capturedAt: p.capturedAt ? new Date(p.capturedAt).toISOString() : ''
      }));

    const exceptions: ExportExceptions = {
      ridesWithoutPayments: ridesWithoutPayments.map(r => ({
        rideId: r.id,
        endedAt: new Date(r.endedAt!).toISOString(),
      })),
      paymentsWithoutRide,
      warnings,
    };

    // 4) Build summaries (turn Decimals to strings at the end)
    const summaryByRate: VatRateBucket[] = Object.entries(sumByRate).map(([rateStr, agg]) => ({
      rate: Number(rateStr),
      count: agg.count,
      base: this.money(agg.base, 2),
      tax: this.money(agg.tax, 2),
      total: this.money(agg.total, 2),
    }));

    const summaryByRateAndMethod: VatRateBucket[] = Object.entries(sumByRateAndMethod).map(([key, agg]) => {
      const [rateStr, method] = key.split('|');
      return {
        rate: Number(rateStr),
        method: method === 'UNKNOWN' ? undefined : method,
        count: agg.count,
        base: this.money(agg.base, 2),
        tax: this.money(agg.tax, 2),
        total: this.money(agg.total, 2),
      };
    });

    return { rows, summaryByRate, summaryByRateAndMethod, exceptions };
  }
}
