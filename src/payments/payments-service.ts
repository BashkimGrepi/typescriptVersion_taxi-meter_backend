import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtValidationResult } from 'src/auth/interfaces/jwt-payload.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConfirmPaymentDto,
  PaymentVerificationResponseDto,
} from './types/payments';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  checkPaymentsWithVivaAPI(rideId: string) {
    throw new Error('Method not implemented.');
  }
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentStatus(paymentId: string, user: JwtValidationResult) {
    // Step 1: Validate access (driver owns this payment)
    await this.validatePaymentAccess(paymentId, user);

    // Step 2: Get the payment data from database
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        rideId: true,
        amount: true, //prisma.decimal
        currency: true,
        status: true,
        externalPaymentId: true,
        capturedAt: true,
        failureCode: true,
      },
    });
    // Step 3: Handle "not found" case
    if (!payment) throw new NotFoundException('Payment not found');

    // Step 4: Convert data types (Decimal -> string)
    // Step 5: Return clean DTO format with additional fields for mobile
    return {
      paymentId: payment.id,
      rideId: payment.rideId,
      amount: payment.amount.toString(), // convert Decimal to string
      currency: payment.currency,
      status: payment.status,
      externalPaymentId: payment.externalPaymentId || undefined,
      capturedAt: payment.capturedAt?.toISOString(),
      failureCode: payment.failureCode || undefined,

      // Additional fields for mobile polling
      orderCode: payment.rideId, // Same as rideId, but clear for Terminal context
      message: this.getStatusMessage(payment.status), // Helper method for UI
    };
  }

  private getStatusMessage(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.PENDING:
        return 'Waiting for terminal...';
      case PaymentStatus.SUBMITTED:
        return 'Processing payment...';
      case PaymentStatus.PAID:
        return 'Payment successful!';
      case PaymentStatus.FAILED:
        return 'Payment failed';
      default:
        return 'Unknown status';
    }
  }

  async validatePaymentAccess(
    paymentId: string,
    user: JwtValidationResult,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        ride: {
          select: {
            driverProfileId: true,
            tenantId: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // does the driver own the ride?
    if (payment.ride.driverProfileId !== user.driverProfileId)
      throw new ForbiddenException(
        'you can only access payments for your own rides',
      );

    // double check tenant
    if (payment.tenantId !== user.tenantId)
      throw new ForbiddenException('Access denied');

    // ALL CHECKS PASSED
  }

  async submitPayment(
    paymentId: string,
    user: JwtValidationResult,
    dto: ConfirmPaymentDto,
  ) {
    // Validate access (driver owns this payment)
    await this.validatePaymentAccess(paymentId, user);

    // Step 2: Get current payment status
    const currentPayment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        capturedAt: true,
        amount: true,
        currency: true,
        externalPaymentId: true,
        rideId: true,
        providerMetadata: true,
      },
    });

    if (!currentPayment) {
      throw new NotFoundException('Payment not found');
    }

    // Step 3: Idempotency check - if already PAID, return existing data
    if (currentPayment.status === 'PAID') {
      return {
        paymentId: currentPayment.id,
        rideId: currentPayment.rideId,
        amount: currentPayment.amount.toString(),
        currency: currentPayment.currency,
        status: currentPayment.status,
        externalPaymentId: currentPayment.externalPaymentId || undefined,
        capturedAt: currentPayment.capturedAt?.toISOString(),
        message: 'Payment already confirmed',
      };
    }

    // Step 4: State validation - only PENDING payments can be confirmed
    if (currentPayment.status !== 'PENDING') {
      throw new ForbiddenException(
        `Cannot confirm payment with status: ${currentPayment.status}`,
      );
    }

    // Step 5: Update payment to submitted with timestamp
    const submittedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.SUBMITTED,
        providerMetadata: {
          hints: {
            transactionId: dto.externalPaymentId,
            approvalCode: dto.approvalCode,
            submittedAt: new Date().toISOString(),
          },
        },
      },
      select: {
        id: true,
        rideId: true,
        amount: true,
        currency: true,
        status: true,
        externalPaymentId: true,
        capturedAt: true,
      },
    });

    // Step 6: Return confirmed payment data
    return {
      paymentId: submittedPayment.id,
      rideId: submittedPayment.rideId,
      amount: submittedPayment.amount.toString(),
      currency: submittedPayment.currency,
      status: submittedPayment.status,
      externalPaymentId: submittedPayment.externalPaymentId || undefined,
      capturedAt: submittedPayment.capturedAt?.toISOString(),
      message: 'Payment confirmed successfully',
    };
  }
  async verifyPaymentWithViva(
    paymentId: string,
    user: JwtValidationResult,
  ): Promise<PaymentVerificationResponseDto> {
    // validate access (driver owns this payment)
    await this.validatePaymentAccess(paymentId, user);

    // get current payment
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        rideId: true,
        status: true,
        amount: true,
        currency: true,
        externalPaymentId: true,
        capturedAt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // if already final, return existing data
    if (
      payment.status === PaymentStatus.PAID ||
      payment.status === PaymentStatus.FAILED
    ) {
      return {
        paymentId: payment.id,
        status: payment.status,
        message:
          payment.status === PaymentStatus.PAID
            ? 'Payment already confirmed'
            : 'Payment already failed',
        wasUpdated: false,
        verificationSource: 'already_final',
        amount: payment.amount.toString(),
        currency: payment.currency,
        orderCode: payment.rideId,
        externalPaymentId: payment.externalPaymentId || undefined,
        capturedAt: payment.capturedAt?.toISOString(),
      };
    }

    // call viva API to check status
    const vivaStatus = await this.checkPaymentWithVivaAPI(payment.rideId);

    // update payment based on viva response
    if (vivaStatus.isPaid) {
      const updatedPayment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          externalPaymentId: vivaStatus.transactionId,
          capturedAt: new Date(),
        },
      });

      return {
        paymentId: updatedPayment.id,
        status: PaymentStatus.PAID,
        message: 'Payment confirmed by Viva verification',
        wasUpdated: true,
        verificationSource: 'viva_api',
        amount: updatedPayment.amount.toString(),
        currency: updatedPayment.currency,
        orderCode: payment.rideId,
        externalPaymentId: vivaStatus.transactionId,
        capturedAt: new Date().toISOString(),
      };
    } else {
      // payment not found or failed in viva
      return {
        paymentId: payment.id,
        status: payment.status,
        message: 'Payment not confirmed yet - webhook may still arrive',
        wasUpdated: false,
        verificationSource: 'viva_api',
        amount: payment.amount.toString(),
        currency: payment.currency,
        orderCode: payment.rideId,
      };
    }
  }

  private async checkPaymentWithVivaAPI(orderCode: string): Promise<{
    isPaid: boolean;
    transactionId?: string;
    amount?: number;
  }> {
    try {
      const vivaApiUrl = process.env.VIVA_API_BASE_URL;
      const apiKey = process.env.VIVA_API_KEY;

      if (!apiKey) {
        return { isPaid: false };
      }

      // Example Viva API call (adjust URL based on actual Viva documentation)
      const response = await fetch(
        `${vivaApiUrl}/v2/transactions?ordercode=${orderCode}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        return { isPaid: false };
      }

      const data = await response.json();

      // Parse Viva response (adjust based on their actual API format)
      const isSuccessful = data.StatusId === 'F' && data.TransactionId;

      return {
        isPaid: isSuccessful,
        transactionId: data.TransactionId,
        amount: data.Amount,
      };
    } catch (error) {
      return { isPaid: false };
    }
  }
}
