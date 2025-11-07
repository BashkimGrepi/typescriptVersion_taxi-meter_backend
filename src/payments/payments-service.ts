import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtValidationResult } from 'src/auth/interfaces/jwt-payload.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfirmPaymentDto } from './types/payments';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentById(paymentId: string) {
    // Step 1: Get the payment data from database
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
    // Step 2: Handle "not found" case
    if (!payment) throw new NotFoundException('Payment not found');

    // Step 3: Convert data types (Decimal -> string)
    // Step 4: Return clean DTO format
    return {
      paymentId: payment.id,
      rideId: payment.rideId,
      amount: payment.amount.toString(), // convert Decimal to string
      currency: payment.currency,
      status: payment.status,
      externalPaymentId: payment.externalPaymentId || undefined,
      capturedAt: payment.capturedAt?.toISOString(),
      failureCode: payment.failureCode || undefined,
    };
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

  async confirmPayment(
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

    // Step 5: Update payment to PAID with timestamp
    const confirmedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'PAID',
        capturedAt: new Date(),
        externalPaymentId:
        dto.externalPaymentId ?? currentPayment.externalPaymentId,
        approvalCode: dto.approvalCode ?? undefined,
        //cardScheme: dto.cardScheme ?? undefined,
        //last4: dto.last4 ?? undefined,
        // Could add external confirmation reference from dto if needed
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
      paymentId: confirmedPayment.id,
      rideId: confirmedPayment.rideId,
      amount: confirmedPayment.amount.toString(),
      currency: confirmedPayment.currency,
      status: confirmedPayment.status,
      externalPaymentId: confirmedPayment.externalPaymentId || undefined,
      capturedAt: confirmedPayment.capturedAt?.toISOString(),
      message: 'Payment confirmed successfully',
    };
  }
}
