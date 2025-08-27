import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, PaymentStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type NumberingResult = {
  tenantId: string;
  period: string;                 // 'YYYYMM'
  type: 'simplified';             // later: 'full'
  startingNumber: number | null;  // before assigning
  endingNumber: number | null;    // after assigning
  assignedCount: number;
  alreadyNumberedCount: number;
  assigned: Array<{ paymentId: string; receiptNumber: string }>;
};

@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Helper: format a Date to 'YYYYMM' */
  private yyyymm(d: Date): string {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1; // 0-based
    return `${y}${m.toString().padStart(2, '0')}`;
  }

  /** Guard: window must be a single calendar month */
  private assertSingleMonth(from: Date, to: Date) {
    if (!(from instanceof Date) || !(to instanceof Date) || isNaN(+from) || isNaN(+to)) {
      throw new BadRequestException('Invalid date range');
    }
    if (+from >= +to) throw new BadRequestException('from must be earlier than to');

    const pFrom = this.yyyymm(from);
    const pTo = this.yyyymm(new Date(to.getTime() - 1)); // inclusive end day
    if (pFrom !== pTo) {
      throw new BadRequestException('Export must cover a single month (one YYYYMM period).');
    }
    return pFrom;
  }

  /**
   * Assign sequential receipt numbers for simplified receipts.
   *
   * WHY this shape?
   * - We pass tenantId + [from,to) because exports are tenant-scoped and time-bounded.
   * - We sort by (capturedAt, id) to make assignment deterministic.
   * - We run a single DB transaction so concurrent exports can’t collide.
   */
  async assignSimplifiedReceiptNumbers(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<NumberingResult> {
    const period = this.assertSingleMonth(from, to);

    // 1) Collect candidate payments: PAID in window, tenant-scoped.
    // WHY join later? We don’t need joins for numbering—only payment identity + timestamps.
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        status: PaymentStatus.PAID,
        capturedAt: { gte: from, lt: to },
      },
      select: { id: true, capturedAt: true, receiptNumber: true, numberPeriod: true },
      orderBy: [{ capturedAt: 'asc' }, { id: 'asc' }], // WHY: deterministic assignment
    });

    // Partition into already-numbered vs needs-assignment.
    const already = payments.filter(p => p.receiptNumber);
    const toAssign = payments.filter(p => !p.receiptNumber);

    // Sanity: if any already-numbered payment has a different period, flag it.
    for (const p of already) {
      if (p.numberPeriod && p.numberPeriod !== period) {
        throw new BadRequestException(
          `Payment ${p.id} already has numberPeriod=${p.numberPeriod}, not ${period}. Refuse to mix periods.`
        );
      }
    }

    // 2) If nothing to assign, return a quick summary now.
    if (toAssign.length === 0) {
      // We still want to report the current "ending number" if any.
      const last = await this.prisma.numberSequence.findUnique({
        where: { tenantId_type_period: { tenantId, type: 'RECEIPT', period } },
        select: { current: true },
      });
      const current = last?.current ?? null;
      return {
        tenantId,
        period,
        type: 'simplified',
        startingNumber: current,
        endingNumber: current,
        assignedCount: 0,
        alreadyNumberedCount: already.length,
        assigned: [],
      };
    }

    // 3) Assign inside a transaction with the strongest isolation we can get.
    // WHY: guarantees uniqueness & order even if two exports run at once.
    // Note: if your DB/driver doesn’t support Serializable isolation, Prisma will ignore it;
    // your unique constraints still protect you.
    const result = await this.prisma.$transaction(async (tx) => {
      // 3a) Lock/init the sequence row for (tenantId, RECEIPT, period)
      const seq = await tx.numberSequence.upsert({
        where: { tenantId_type_period: { tenantId, type: 'RECEIPT', period } },
        update: {},
        create: { tenantId, type: 'RECEIPT', period, current: 0 },
        select: { current: true },
      });

      const assigned: Array<{ paymentId: string; receiptNumber: string }> = [];
      let current = seq.current; // last number used

      // 3b) Assign in deterministic order
      for (const p of toAssign) {
        // Double-check within TX: still unassigned (idempotency if retried)
        const fresh = await tx.payment.findUnique({
          where: { id: p.id },
          select: { receiptNumber: true, numberPeriod: true, tenantId: true, status: true, capturedAt: true },
        });
        if (!fresh) continue;
        if (fresh.tenantId !== tenantId) {
          throw new BadRequestException(`Payment ${p.id} belongs to a different tenant.`);
        }
        if (fresh.status !== PaymentStatus.PAID) {
          // Someone changed it; skip safely.
          continue;
        }
        if (fresh.receiptNumber) {
          // Already numbered by another concurrent TX; skip.
          continue;
        }
        // Guard the period: capturedAt must still be within this window/month
        const pPeriod = this.yyyymm(fresh.capturedAt!);
        if (pPeriod !== period) {
          throw new BadRequestException(
            `Payment ${p.id} captured in ${pPeriod}, but export period is ${period}.`
          );
        }

        // Issue next number
        current += 1;
        const formatted = `${period}-${current.toString().padStart(4, '0')}`;

        // Update payment row
        await tx.payment.update({
          where: { id: p.id },
          data: {
            numberPeriod: period,
            receiptNumber: formatted,
          },
          select: { id: true },
        });

        assigned.push({ paymentId: p.id, receiptNumber: formatted });
      }

      // 3c) Persist the updated counter
      await tx.numberSequence.update({
        where: { tenantId_type_period: { tenantId, type: 'RECEIPT', period } },
        data: { current },
      });

      return {
        startingNumber: seq.current,
        endingNumber: current,
        assigned,
      };
    }, {
      isolationLevel: (Prisma as any).TransactionIsolationLevel?.Serializable ?? undefined,
    });

    return {
      tenantId,
      period,
      type: 'simplified',
      startingNumber: result.startingNumber,
      endingNumber: result.endingNumber,
      assignedCount: result.assigned.length,
      alreadyNumberedCount: already.length,
      assigned: result.assigned,
    };
  }
}
