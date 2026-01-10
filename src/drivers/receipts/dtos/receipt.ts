import { Decimal } from '@prisma/client/runtime/library';
import { IsNotEmpty, IsString } from 'class-validator';

export interface GenerateReceiptResponseDto {
  receiptId: string;
  publicId: string;
  receiptUrl: string;
  expiresAt: string; // ISO string
  status: 'ISSUED' | 'DRAFT';
  rideId: string;
  paymentId: string;
  paymentStatus: 'PAID';

  // for UI display
  amount: string;
  currency: string;
  issuedAt: string; // ISO string
}

export class PublicReceiptQueryDto {
  @IsString()
  @IsNotEmpty()
  t!: string; // token
}

export interface SnapshotJson {
  tenantName: string;
  tenantId: string;
  businessId: string;

  ride: {
    id: string;
    startedAt: string; // ISO string
    endedAt: string; // ISO string
    distanceKm: Decimal | null;
    durationMin: Decimal | null;
  };
  payment: {
    id: string;
    status: string;
    provider: string;
    externalPaymentId?: string | null;
    capturedAt: string; // ISO string
  };
  totals: {
    subtotal: Decimal;
    currency: string;
  };
  issuedAt: string; // ISO string
}
