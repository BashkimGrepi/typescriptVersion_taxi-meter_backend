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
    @Request() req
  ): Promise<PaymentsPageResponse> {
    const tenantId = req.user.tenantId;
    return this.adminPaymentService.getPayments(tenantId, query);
  }

  @Get('summary')
  async getPaymentsSummary(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const tenantId = req.user.tenantId;
    return this.adminPaymentService.getPaymentsSummary(tenantId, from, to);
  }

  @Get(':id')
  async getPaymentById(
    @Param('id') paymentId: string,
    @Request() req
  ): Promise<PaymentResponseDto> {
    const tenantId = req.user.tenantId;
    return this.adminPaymentService.getPaymentById(tenantId, paymentId);
  }

  @Post()
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req
  ): Promise<PaymentResponseDto> {
    const tenantId = req.user.tenantId;
    return this.adminPaymentService.createPayment(tenantId, createPaymentDto);
  }

  @Patch(':id')
  async updatePayment(
    @Param('id') paymentId: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @Request() req
  ): Promise<PaymentResponseDto> {
    const tenantId = req.user.tenantId;
    return this.adminPaymentService.updatePayment(tenantId, paymentId, updatePaymentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePayment(
    @Param('id') paymentId: string,
    @Request() req
  ): Promise<void> {
    const tenantId = req.user.tenantId;
    await this.adminPaymentService.deletePayment(tenantId, paymentId);
  }
}
