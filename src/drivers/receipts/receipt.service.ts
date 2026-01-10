import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateReceiptResponseDto, SnapshotJson } from './dtos/receipt';
import { randomBytes } from 'crypto';
import { ReceiptLinkTokenService } from './receiptLinkTokenService';

@Injectable()
export class ReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptLinkTokenService: ReceiptLinkTokenService,
  ) {}

  async generateReceipt(
    rideId: string,
    tenantId: string,
    userId: string,
  ): Promise<GenerateReceiptResponseDto> {
    // verufy the tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || tenant.deletedAt)
      throw new Error('Tenant not found or deleted');

    //verify the driver profile exists
    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: { userId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!driverProfile)
      throw new NotFoundException('Driver profile not found or inactive');

    // verify the ride exists and belongs to the driver
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, tenantId, driverProfileId: driverProfile.id },
      select: {
        id: true,
        payment: true,
        status: true,
        startedAt: true,
        endedAt: true,
        distanceKm: true,
        durationMin: true,
      },
    });

    if (!ride) throw new NotFoundException('Ride not found for this driver');
    if (ride.status !== 'COMPLETED')
      throw new ConflictException(
        'Cannot generate receipt for incomplete ride',
      );

    // verify the payment exists for the ride with status paid
    const payment = await this.prisma.payment.findFirst({
      where: {
        rideId: ride.id,
        tenantId,
      },
    });

    if (!payment)
      throw new NotFoundException('No paid payment found for this ride');

    if (payment.status !== 'PAID')
      throw new ConflictException('Cannot generate receipt for unpaid ride');

    // build the receipt snapshot (stored on receipt.dataJson)
    const snapshot: SnapshotJson = {
      tenantName: tenant.name,
      tenantId: tenant.id,
      businessId: tenant.businessId,
      ride: {
        id: ride.id,
        startedAt: ride.startedAt?.toISOString?.() ?? String(ride.startedAt),
        endedAt: ride.endedAt?.toISOString?.() ?? String(ride.endedAt ?? ''),
        distanceKm: ride.distanceKm,
        durationMin: ride.durationMin,
      },
      payment: {
        id: payment.id,
        status: payment.status,
        provider: payment.provider,
        externalPaymentId: payment.externalPaymentId ?? undefined,
        capturedAt:
          payment.capturedAt?.toISOString?.() ??
          String(payment.capturedAt ?? ''),
      },
      totals: {
        subtotal: payment.amount,
        currency: payment.currency,
      },
      issuedAt: new Date().toISOString(),
    };

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24);
    const baseUrl = 'http://192.168.101.105:3000';

    const existingReceipt = await this.prisma.receipt.findFirst({
      where: { rideId: ride.id },
    });

    const receipt = existingReceipt
      ? await this.prisma.receipt.update({
          where: { id: existingReceipt.id },
          data: {
            expiresAt,
            status: 'ISSUED',
            issuedAt: now,
            paymentId: payment.id,
            dataJson: snapshot as unknown as Prisma.InputJsonValue,
          },
        })
      : await this.prisma.receipt.create({
          data: {
            tenantId,
            rideId: ride.id,
            paymentId: payment.id,
            publicId: this.makePublicId(),
            status: 'ISSUED',
            issuedAt: now,
            expiresAt,
            dataJson: snapshot as unknown as Prisma.InputJsonValue,
          },
        });

    const token = this.receiptLinkTokenService.sign({
      publicId: receipt.publicId,
      tenantId,
      expiresInMinutes: 60 * 24 * 7, // 7 days
    });

    const receiptUrl = `${baseUrl.replace(/\/$/, '')}/r/rcpt/${receipt.publicId}?t=${encodeURIComponent(token)}`;

    return {
      receiptUrl,
      receiptId: receipt.id,
      publicId: receipt.publicId,
      expiresAt: receipt.expiresAt?.toISOString() || '',
      issuedAt: receipt.issuedAt.toISOString(),
      status: receipt.status as 'ISSUED' | 'DRAFT',
      rideId: ride.id,
      paymentId: payment.id,
      paymentStatus: payment.status as 'PAID',
      amount: payment.amount.toString(),
      currency: payment.currency,
    };
  }

  private makePublicId(): string {
    return randomBytes(16).toString('hex');
  }

  // render receipt HTML
  async renderReceiptHtml(params: {
    publicId: string;
    token: string;
  }): Promise<string> {
    const { publicId, token } = params;

    // verify the token
    let payload: { publicId: string; tenantId: string; typ?: string };
    try {
      payload = this.receiptLinkTokenService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // ensure token is meant for receipts and matches the publicId
    if (payload.publicId !== publicId) {
      throw new UnauthorizedException('Token does not match receipt');
    }

    if (!payload.typ || payload.typ !== 'receipt-link') {
      throw new UnauthorizedException('Invalid token type');
    }

    // load the receipt
    const receipt = await this.prisma.receipt.findUnique({
      where: { publicId },
    });

    if (!receipt) throw new NotFoundException('Receipt not found');

    // for extra check db expiry
    if (receipt.expiresAt && receipt.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Receipt has expired');
    }

    // tenant check
    if (payload.tenantId && receipt.tenantId !== payload.tenantId) {
      throw new UnauthorizedException(
        'Token tenant does not match receipt tenant',
      );
    }

    return this.buildHtml(receipt.publicId, receipt.dataJson as any);
  }

  private buildHtml(publicId: string, data: SnapshotJson): string {
    const tenantName = data.tenantName;
    const tenantId = data.tenantId;
    const businessId = (data as any)?.businessId || '';
    const ride = {
      id: data.ride.id,
      startedAt: data.ride.startedAt,
      endedAt: data.ride.endedAt,
      distanceKm: data.ride.distanceKm,
      durationMin: data.ride.durationMin,
    };
    const payment = {
      id: data.payment.id,
      status: data.payment.status,
      provider:
        (data as any)?.payment?.provider ??
        (data as any)?.payment?.method ??
        '',
      externalPaymentId: data.payment.externalPaymentId,
      capturedAt: data.payment.capturedAt,
    };
    const totals = {
      subtotal: data.totals.subtotal,
      currency: data.totals.currency,
    };
    const issuedAt = data.issuedAt;

    const hasDistance =
      ride.distanceKm !== null && ride.distanceKm !== undefined;
    const hasDuration =
      ride.durationMin !== null && ride.durationMin !== undefined;

    // Simple HTML rendering

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt ${publicId}</title>
</head>
<body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin:0; background:#f6f6f6;">
  <div style="max-width:520px; margin:0 auto; padding:16px;">
    <div style="background:#fff; border-radius:14px; padding:16px; box-shadow:0 4px 18px rgba(0,0,0,0.06);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div>
          <div style="font-size:18px; font-weight:700;">${this.escape(tenantName)}</div>
          ${businessId ? `<div style="color:#555; margin-top:4px;">Business ID: ${this.escape(String(businessId))}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; color:#666;">Receipt</div>
          <div style="font-weight:700;">${businessId ? this.escape(String(businessId)) : this.escape(String(tenantId))}</div>
        </div>
      </div>

      <hr style="border:none; border-top:1px solid #eee; margin:16px 0;" />

      <div style="display:flex; justify-content:space-between; gap:12px;">
        <div style="color:#666;">Total</div>
        <div style="font-size:22px; font-weight:800;">${this.escape(String(totals.subtotal))} ${this.escape(totals.currency)}</div>
      </div>

      <div style="margin-top:12px; color:#333;">
        ${issuedAt ? `<div><b>Issued:</b> ${this.escape(issuedAt)}</div>` : ''}
        ${ride.startedAt ? `<div><b>Start:</b> ${this.escape(ride.startedAt)}</div>` : ''}
        ${ride.endedAt ? `<div><b>End:</b> ${this.escape(ride.endedAt)}</div>` : ''}
        ${hasDistance ? `<div><b>Distance:</b> ${this.escape(String(ride.distanceKm))} km</div>` : ''}
        ${hasDuration ? `<div><b>Duration:</b> ${this.escape(String(ride.durationMin))} sec</div>` : ''}
      </div>

      <hr style="border:none; border-top:1px solid #eee; margin:16px 0;" />

      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <div style="color:#666;">Subtotal</div>
        <div>${this.escape(String(totals.subtotal))} ${this.escape(totals.currency)}</div>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <div style="color:#666;">VAT</div>
        <div>${this.escape('vat should be here')} ${this.escape(totals.currency)}</div>
      </div>
      <div style="display:flex; justify-content:space-between; font-weight:700;">
        <div>Total</div>
        <div>${this.escape(String(totals.subtotal))} ${this.escape(totals.currency)}</div>
      </div>

      ${
        payment.provider
          ? `
      <hr style="border:none; border-top:1px solid #eee; margin:16px 0;" />
      <div style="color:#333;">
        ${payment.provider ? `<div><b>Payment:</b> ${this.escape(String(payment.provider))}</div>` : ''}
        
      </div>
      `
          : ''
      }

      <div style="margin-top:18px; font-size:12px; color:#777;">
        Powered by MeterSY
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private escape(input: string): string {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
