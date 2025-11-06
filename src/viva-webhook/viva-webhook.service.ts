import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { VivaWebhookPayload } from './viva-webhook.dto';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class VivaWebhookService {
  private readonly logger = new Logger(VivaWebhookService.name);
  constructor(private readonly prisma: PrismaService) {}

  async processPaymentCreatedEvent(payload: VivaWebhookPayload) {
    // Step 1: Extract TransactionId early for webhook creation
    const eventData = payload.EventData;
    const TransactionId = eventData?.TransactionId;

    if (!TransactionId) {
      this.logger.error('Missing TransactionId in webhook payload', payload);
      return { status: 'error', reason: 'missing_transaction_id' };
    }

    // Step 2: Create/update webhook event FIRST (for proper idempotency)
    const webhookEvent = await this.prisma.webhookEvent.upsert({
      where: { externalId: TransactionId },
      create: {
        provider: 'VIVA',
        eventType: 'Transaction Payment Created',
        externalId: TransactionId,
        payloadJson: JSON.parse(JSON.stringify(payload)),
        receivedAt: new Date(),
      },
      update: {
        attemptCount: { increment: 1 },
      },
    });

    // Step 3: Check if already processed (idempotency)
    if (webhookEvent.processedAt) {
      return { status: 'already_processed', webhookId: webhookEvent.id };
    }

    // Step 4: Now do all validations with webhookEvent available
    if (payload.EventTypeId !== 1796) {
      await this.markWebhookFailed(
        webhookEvent.id,
        `Unsupported event type: ${payload.EventTypeId}`,
      );
      return { status: 'ignored', reason: 'unsupported_event_type' };
    }

    if (!eventData) {
      await this.markWebhookFailed(
        webhookEvent.id,
        'EventData is missing in the payload',
      );
      return { status: 'error', reason: 'missing_event_data' };
    }

    // Step 5: Validate required fields
    const { OrderCode, StatusId, Amount, MerchantId } = eventData;
    if (!OrderCode || !StatusId || Amount === undefined || !MerchantId) {
      await this.markWebhookFailed(
        webhookEvent.id,
        'Missing required fields in EventData',
      );
      return { status: 'error', reason: 'missing_required_fields' };
    }

    // Step 6: Only process finished transactions
    if (StatusId !== 'F') {
      this.logger.log(
        `Ignoring non-finished transaction: ${TransactionId} with status ${StatusId}`,
      );
      // Don't mark as failed - this is expected behavior
      return { status: 'ignored', reason: 'not_finished' };
    }

    // Step 7: Verify merchant ID
    const expectedMerchantId = process.env.VIVA_MERCHANT_ID;
    if (expectedMerchantId && MerchantId !== expectedMerchantId) {
      await this.markWebhookFailed(
        webhookEvent.id,
        `MerchantId mismatch: expected ${expectedMerchantId}, got ${MerchantId}`,
      );
      return { status: 'error', reason: 'merchant_id_mismatch' };
    }

    // find the payment by orderCode (ride id)
    const payment = await this.prisma.payment.findFirst({
      where: {
        rideId: OrderCode.toString(),
        status: PaymentStatus.PENDING,
      },
    });
    if (!payment) {
      await this.markWebhookFailed(
        webhookEvent.id,
        `Payment not found for rideId: ${OrderCode}`,
      );
      return { status: 'ignored', reason: 'payment_not_found' };
    }

    //validate amount matches (convert to cents if needed)
    const expectedAmountCents = Math.round(
      parseFloat(payment.amount.toString()) * 100,
    );
    if (Amount !== expectedAmountCents) {
      await this.markWebhookFailed(
        webhookEvent.id,
        `Amount mismatch: expected ${expectedAmountCents}, got ${Amount}`,
      );
      return { status: 'ignored', reason: 'amount_mismatch' };
    }

    // update payment to paid
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        externalPaymentId: TransactionId,
        capturedAt: new Date(),
        
          
          
      },
    });
    // mark webhook as processed
    await this.prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processedAt: new Date(),
        paymentId: payment.id,
        rideId: payment.rideId,
      },
    });

    this.logger.log('Payment successfully updated to PAID', {
      paymentId: payment.id,
      rideId: OrderCode,
      transactionId: TransactionId,
      amount: Amount,
    });
  }

  async markWebhookFailed(
    webhookId: string,
    errorMessage: string,
    markAsProcessed: boolean = false,
  ) {
    const updateData: any = {
      errorMessage,
      attemptCount: { increment: 1 },
    };

    // Only mark as processed for permanent failures (not retryable errors)
    if (markAsProcessed) {
      updateData.processedAt = new Date();
    }

    await this.prisma.webhookEvent.update({
      where: { id: webhookId },
      data: updateData,
    });

    this.logger.warn(`Webhook ${webhookId} failed: ${errorMessage}`, {
      processed: markAsProcessed,
    });
  }
}
