import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminRoleGuard } from 'src/admin/guards/admin-role.guard';
import { UniversalV1Guard } from 'src/auth/guards/universal-v1.guard';
import {
  GetProfitTimelineQueryDto,
  ProfitGranularity,
} from '../dtos/paymentsTransactionsDtos';
import { PaymentsTransactionsService } from '../services/paymentsTransactions.service';
import { GetPaymentsQueryDto } from '../dtos/getPayments.dto';
    
@Controller('admin/payments-transactions')
@UseGuards(UniversalV1Guard, AdminRoleGuard)
export class PaymentsTransactionsController {
  constructor(private readonly service: PaymentsTransactionsService) {}

  @Get()
  async getPaymentsTransactions(
    @Query('period')
    period: 'all_time' | 'current_month' | 'this_week' | 'this_year',
  ) {
    return this.service.getPaymentsTransactions(period);
  }

    
  @Get('profit-timeline')
  async getProfitTimeline(@Query() query: GetProfitTimelineQueryDto) {
    const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
    const toDate = query.toDate ? new Date(query.toDate) : undefined;
    const granularity = query.granularity || ProfitGranularity.MONTH;

    return this.service.getProfitTimeline(granularity, fromDate, toDate);
  }

  @Get('payments')
  async getPayments(@Query() query: GetPaymentsQueryDto) {
    return this.service.getPaymentsList(query);
  }
}
