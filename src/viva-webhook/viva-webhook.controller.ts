import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Logger,
  Post,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import express from 'express';
import { VivaWebhookService } from './viva-webhook.service';
import { Public } from 'src/decorators/public.decorator';
import { VivaWebhookPayload } from './viva-webhook.dto';
import { error } from 'console';
import { stat } from 'fs';

@Controller('api/webhooks/viva')
export class VivaWebhookController {
  private readonly logger = new Logger(VivaWebhookController.name);
  constructor(private readonly service: VivaWebhookService) {}

  @Public()
  @Get()
  getVerificationKey(@Res() res: express.Response) {
    const verificationKey = process.env.VIVA_WEBHOOK_VERIFICATION_KEY;

    if (!verificationKey) {
      this.logger.error(
        'VIVA_WEBHOOK_VERIFICATION_KEY is not set in environment variables',
      );
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Webhook verification key not configured',
      });
    }

    return res.status(HttpStatus.OK).json({
      Key: verificationKey,
    });
  }

  @Public()
  @Post()
  async processWebhook(@Body() payload: any, @Res() res: express.Response) {
    try {
      this.logger.log(
        'Received viva webhook payload:',
        JSON.stringify(payload, null, 2),
      );

      // Basic validation before processing
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid payload: not an object');
      }

      //process the webhook payload
      await this.service.processPaymentCreatedEvent(payload);

      return res.status(HttpStatus.OK).json({
        status: 'success',
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      this.logger.error('Error processing viva webhook:', error.stack);

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Failed to process webhook',
      });
    }
  }
}
