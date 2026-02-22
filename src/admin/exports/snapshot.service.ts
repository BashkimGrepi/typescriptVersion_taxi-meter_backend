import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExportDataService, ExportPaymentRow, VatRateBucket } from './export-data.service';
import { NumberingService } from './numbering.service';
import * as crypto from 'crypto';
import { TenantScopedService } from 'src/common/services/tenant-scoped.service';
import { REQUEST } from '@nestjs/core';
import { request } from 'express';

type BuildSnapshotArgs = {
  from: Date;
  to: Date;
  type: 'simplified';       // later: 'full'
  generatedBy: { userId: string; email: string };
  includeAnnex?: boolean;   // we’ll keep the flag but won’t render annex in v1
};

type NumberingSummary = {
  period: string;                   // YYYYMM
  startingNumber: number | null;
  endingNumber: number | null;
  assignedCount: number;
  alreadyNumberedCount: number;
};

@Injectable()
export class SnapshotService extends TenantScopedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: ExportDataService,
    private readonly numbering: NumberingService,
    @Inject(REQUEST) request: Express.Request
  ) {
    super(request);
  }

  /** Build the archive JSON and a sha256 hash. */
  async buildSnapshot(args: BuildSnapshotArgs): Promise<{ snapshot: any; sha256: string }> {
    const tenantId = this.getCurrentTenantId();
    const { from, to, type, generatedBy, includeAnnex = false } = args;

    // 1) Resolve tenant identity (why: must print seller info on documents)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, businessId: true, settingsJson: true },
    });
    
    // Safe extraction of vatId from settingsJson (which is typed as Json by Prisma)
    const getVatId = (settings: any): string | null => {
      if (settings && 
          typeof settings === 'object' && 
          settings !== null &&
          !Array.isArray(settings) &&
          typeof settings.vatId === 'string') {
        return settings.vatId;
      }
      return null;
    };
    
    const vatId = getVatId(tenant?.settingsJson) ?? null;

    // 2) Assign numbers (idempotent) and capture the summary
    const numberingRes = await this.numbering.assignSimplifiedReceiptNumbers(from, to);
    const numberingSummary: NumberingSummary = {
      period: numberingRes.period,
      startingNumber: numberingRes.startingNumber,
      endingNumber: numberingRes.endingNumber,
      assignedCount: numberingRes.assignedCount,
      alreadyNumberedCount: numberingRes.alreadyNumberedCount,
    };

    // 3) Load the export dataset (rows, summaries, exceptions) with VAT math
    const { rows, summaryByRate, summaryByRateAndMethod, exceptions } =
      await this.data.loadPaymentsDataset(from, to);

    // 4) Canonical ordering to guarantee repeatable hash
    const sortedRows = this.sortPayments(rows);
    const sortedExceptions = this.sortExceptions(exceptions);

    // 5) Build the snapshot object (keys in a stable order)
    const snapshot = {
      meta: {
        version: 'payments-export/v1',          // bump when schema changes
        type,                                   // 'simplified'
        period: {
          from: from.toISOString(),
          to: to.toISOString(),
          yyyymm: numberingSummary.period,
        },
        tenant: {
          id: tenant?.id ?? tenantId,
          name: tenant?.name ?? 'UNKNOWN',
          businessId: tenant?.businessId ?? null,
          vatId,
        },
        generatedAt: new Date().toISOString(),
        generatedBy,
        numbering: numberingSummary,
      },
      vat: {
        summaryByRate: this.toPlainBuckets(summaryByRate),
        summaryByRateAndMethod: this.toPlainBuckets(summaryByRateAndMethod),
      },
      payments: sortedRows.map(r => this.normalizePaymentRow(r)),
      exceptions: sortedExceptions,
      // Keep a place for annex content later (v2)
      annex: includeAnnex ? { enabled: true } : { enabled: false },
    };

    // 6) Hash the final JSON string (WHY: integrity proof)
    const json = JSON.stringify(snapshot);
    const sha256 = crypto.createHash('sha256').update(json).digest('hex');

    return { snapshot, sha256 };
  }

  // ---- helpers (kept small & deterministic) -------------------------------

  /** Sort by receiptNumber asc (nulls last), then capturedAt asc, then paymentId */
  private sortPayments(rows: ExportPaymentRow[]): ExportPaymentRow[] {
    const asNum = (s: string | null) => {
      if (!s) return null;
      // "YYYYMM-0001" -> number 1; keep YYYYMM as text
      const parts = s.split('-');
      return parts.length === 2 ? parseInt(parts[1], 10) : null;
    };
    return [...rows].sort((a, b) => {
      const na = asNum(a.receiptNumber);
      const nb = asNum(b.receiptNumber);
      if (na == null && nb != null) return 1;
      if (nb == null && na != null) return -1;
      if (na != null && nb != null && na !== nb) return na - nb;
      // fallback by dates/ids
      const ca = +new Date(a.capturedAt);
      const cb = +new Date(b.capturedAt);
      if (ca !== cb) return ca - cb;
      return a.paymentId.localeCompare(b.paymentId);
    });
  }

  /** Keep exceptions stable for hashing */
  private sortExceptions(ex: any) {
    const rides = [...(ex.ridesWithoutPayments ?? [])].sort((x, y) => {
      const dx = +new Date(x.endedAt);
      const dy = +new Date(y.endedAt);
      if (dx !== dy) return dx - dy;
      return x.rideId.localeCompare(y.rideId);
    });
    const pays = [...(ex.paymentsWithoutRide ?? [])].sort((x, y) => {
      const dx = +new Date(x.capturedAt);
      const dy = +new Date(y.capturedAt);
      if (dx !== dy) return dx - dy;
      return x.paymentId.localeCompare(y.paymentId);
    });
    const warnings = [...(ex.warnings ?? [])].sort();
    return { ridesWithoutPayments: rides, paymentsWithoutRide: pays, warnings };
  }

  /** Ensure buckets are plain data with money as strings, rate as number */
  private toPlainBuckets(b: VatRateBucket[]) {
    // They’re already plain, but mapping keeps key order stable
    return b.map(x => ({
      rate: x.rate,
      method: x.method ?? undefined,
      count: x.count,
      base: x.base,
      tax: x.tax,
      total: x.total,
    }));
  }

  /** Pick and order fields for each payment line */
  private normalizePaymentRow(r: ExportPaymentRow) {
    return {
      paymentId: r.paymentId,
      receiptNumber: r.receiptNumber,
      capturedAt: r.capturedAt,     // ISO
      serviceDate: r.serviceDate,   // ISO or null
      description: r.description,   // "Passenger transport"
      rate: r.rate,                 // 0.14 or 0.10
      base: r.base,                 // "xx.yy"
      tax: r.tax,                   // "xx.yy"
      total: r.total,               // "xx.yy"
      currency: r.currency,         // "EUR"
      method: r.method ?? undefined,
      driverName: r.driverName ?? undefined,
      vehicleRef: r.vehicleRef ?? undefined,
      rideId: r.rideId ?? undefined,
      externalPaymentId: r.externalPaymentId ?? undefined,
    };
  }
}
