import { PaymentStatus } from '@prisma/client';

export interface PaymentResponseDto {
  paymentId: string;
  rideId: string;
  amount: string; // in major currency unit, e.g. "10.50"
  currency: 'EUR';
  status: PaymentStatus;
  externalPauymentId?: string; // e.g. pi_xxx or Viva transaction id, platform-observed stripe object ID
  capturedAt?: string;
  failureCode?: string;
}

export interface ConfirmPaymentDto {
  externalPaymentId: string;
  approvalCode?: string; // optional, depending on payment method
  cardScheme?: string; // optional, e.g. VISA, MASTERCARD
  last4?: string; // optional, last 4 digits of card
}

export interface FailPaymentDto {
  failureCode: string;
  failureMessage?: string;
}

export interface PaymentStatusDto {
  paymentId: string;
  rideId: string;
  status: PaymentStatus;
  amount: string; // in major currency unit, e.g. "10.50"
  currency: string;
  externalPaymentId?: string;
  capturedAt?: string;
  failureCode?: string;

  orderCode?: string; // Viva Terminal order code
  message?: string; // human-readable status message
}

export class PaymentVerificationResponseDto {
  paymentId: string;
  status: PaymentStatus;
  message: string;
  wasUpdated: boolean; // Did we change the status?
  verificationSource: string; // "viva_api" or "already_final"

  // Standard payment fields
  amount: string;
  currency: string;
  orderCode: string;
  externalPaymentId?: string;
  capturedAt?: string;
}
