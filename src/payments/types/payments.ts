import { PaymentStatus } from "@prisma/client";

export interface PaymentResponseDto {
    paymentId: string;
    rideId: string;
    amount: string; // in major currency unit, e.g. "10.50"
    currency: "EUR";
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