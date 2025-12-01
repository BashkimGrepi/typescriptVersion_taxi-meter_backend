import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments-service';
import * as payments from './types/payments';
import { UniversalV1Guard } from 'src/auth/guards/universal-v1.guard';

@Controller('driver/payments')
@UseGuards(UniversalV1Guard) // protects route and contains jwt authentication
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get(':id')
  async getDriverPayment(@Param('id') paymentId: string, @Request() req: any) {
    // gets payment id, rideid, amount, currency, status, externalpaymentId

    await this.service.validatePaymentAccess(paymentId, req.user);

    return this.service.getPaymentById(paymentId);
  }

  // Confirm payment with cash method ->> needs modification in the service
  @Post(':id/confirm/cash')
  async confirmDriverPayment(
    @Param('id') paymentId: string,
    @Body() dto: payments.ConfirmPaymentDto,
    @Request() req: any,
  ) {
    // confirms payment by id
    // sets status "paid" and capturedAt = now
    return this.service.confirmPayment(paymentId, req.user, dto);
  }
}
