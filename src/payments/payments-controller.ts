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
import { DriverV1Guard } from 'src/auth/guards/driver-v1.guard';
import { JwtValidationResult } from 'src/auth/interfaces/jwt-payload.interface';

@Controller('driver/payments')
@UseGuards(DriverV1Guard) // protects route and contains jwt authentication
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get(':id')
  @UseGuards(DriverV1Guard) // Ensure only drivers can access
  async getPaymentStatus(
    @Param('id') paymentId: string,
    @Request() req: any,
  ): Promise<payments.PaymentStatusDto> {
    const user: JwtValidationResult = req.user;
    return this.service.getPaymentStatus(paymentId, user);
  }

  @Post(':id/confirm')
  async confirmDriverPayment(
    @Param('id') paymentId: string,
    @Body() dto: payments.ConfirmPaymentDto,
    @Request() req: any,
  ) {
    // confirms payment by id
    // sets status "paid" and capturedAt = now
    return this.service.submitPayment(paymentId, req.user, dto);
  }

  @Post(':id/verify')
  @UseGuards(DriverV1Guard) // Ensure only drivers can access
  async verifyPaymentWithViva(
    @Param('id') paymentId: string,
    @Request() req: any,
  ): Promise<payments.PaymentVerificationResponseDto> {
    const user: JwtValidationResult = req.user;
    return this.service.verifyPaymentWithViva(paymentId, user);
  }
}
