import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete,
  Body, 
  Param, 
  Query, 
  Request,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { UniversalV1Guard } from '../../auth/guards/universal-v1.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../decorators/admin-role.decorator';
import { AdminPaymentService } from '../services/admin-payment.service';
import { 
  CreatePaymentDto, 
  UpdatePaymentDto,
  PaymentsQueryDto, 
  PaymentResponseDto, 
  PaymentsPageResponse 
} from '../dto/payment-admin.dto';

@ApiTags('admin-payments')
@ApiBearerAuth('JWT-auth')
@Controller('admin/payments')
@UseGuards(UniversalV1Guard, AdminRoleGuard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminPaymentController {
  constructor(private adminPaymentService: AdminPaymentService) {}

  @Get()
  async getPayments(
    @Query(new ValidationPipe({ transform: true })) query: PaymentsQueryDto,
  ): Promise<PaymentsPageResponse> {
    return this.adminPaymentService.getPayments(query);
  }

  @Get('summary')
  async getPaymentsSummary(
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.adminPaymentService.getPaymentsSummary(from, to);
  }

  @Get(':id')
  async getPaymentById(
    @Param('id') paymentId: string,
  ): Promise<PaymentResponseDto> {
    return this.adminPaymentService.getPaymentById(paymentId);
  }

  @Post()
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req
  ): Promise<PaymentResponseDto> {
    return this.adminPaymentService.createPayment(createPaymentDto);
  }

  @Patch(':id')
  async updatePayment(
    @Param('id') paymentId: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @Request() req
  ): Promise<PaymentResponseDto> {
    return this.adminPaymentService.updatePayment(paymentId, updatePaymentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePayment(
    @Param('id') paymentId: string,
  ): Promise<void> {
    await this.adminPaymentService.deletePayment(paymentId);
  }
}
