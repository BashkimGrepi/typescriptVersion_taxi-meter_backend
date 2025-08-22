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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
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
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminPaymentController {
  constructor(private adminPaymentService: AdminPaymentService) {}

  @Get()
  @ApiOperation({
    summary: 'List payments (Admin/Manager)',
    description: 'Get paginated list of payments for the current tenant with optional filters'
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO string)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO string)' })
  @ApiQuery({ name: 'paymentMethod', required: false, enum: ['cash', 'card'] })
  @ApiQuery({ name: 'driverId', required: false, description: 'Filter by driver profile ID' })
  @ApiQuery({ name: 'minAmount', required: false, description: 'Minimum amount filter' })
  @ApiQuery({ name: 'maxAmount', required: false, description: 'Maximum amount filter' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Items per page', example: 25 })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tenantId: { type: 'string' },
              rideId: { type: 'string' },
              amount: { type: 'string' },
              paymentMethod: { type: 'string' },
              notes: { type: 'string' },
              createdAt: { type: 'string' }
            }
          }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async getPayments(
    @Query(new ValidationPipe({ transform: true })) query: PaymentsQueryDto,
    @Request() req
  ): Promise<PaymentsPageResponse> {
    const tenantId = req.user.tenantId;
    return this.adminPaymentService.getPayments(tenantId, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get payments summary (Admin/Manager)',
    description: 'Get aggregated payment statistics for the current tenant'
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO string)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO string)' })
  @ApiResponse({
    status: 200,
    description: 'Payment summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalPayments: { type: 'number' },
        totalAmount: { type: 'string' },
        paymentMethods: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              method: { type: 'string' },
              count: { type: 'number' },
              totalAmount: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async getPaymentsSummary(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const tenantId = req.user.tenantId;
    return this.adminPaymentService.getPaymentsSummary(tenantId, from, to);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get payment by ID (Admin/Manager)',
    description: 'Get detailed information about a specific payment'
  })
  @ApiParam({ name: 'id', description: 'Payment ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @ApiResponse({
    status: 200,
    description: 'Payment retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        rideId: { type: 'string' },
        amount: { type: 'string' },
        paymentMethod: { type: 'string' },
        notes: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentById(
    @Param('id') paymentId: string,
    @Request() req
  ): Promise<PaymentResponseDto> {
    const tenantId = req.user.tenantId;
    return this.adminPaymentService.getPaymentById(tenantId, paymentId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create payment (Admin/Manager)',
    description: 'Create a new payment for a ride'
  })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        rideId: { type: 'string' },
        amount: { type: 'string' },
        paymentMethod: { type: 'string' },
        notes: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Payment already exists or invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req
  ): Promise<PaymentResponseDto> {
    const tenantId = req.user.tenantId;
    return this.adminPaymentService.createPayment(tenantId, createPaymentDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update payment (Admin/Manager)',
    description: 'Update an existing payment'
  })
  @ApiParam({ name: 'id', description: 'Payment ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @ApiResponse({
    status: 200,
    description: 'Payment updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        rideId: { type: 'string' },
        amount: { type: 'string' },
        paymentMethod: { type: 'string' },
        notes: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
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
  @ApiOperation({
    summary: 'Delete payment (Admin/Manager)',
    description: 'Delete a payment record'
  })
  @ApiParam({ name: 'id', description: 'Payment ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @ApiResponse({ status: 204, description: 'Payment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async deletePayment(
    @Param('id') paymentId: string,
    @Request() req
  ): Promise<void> {
    const tenantId = req.user.tenantId;
    await this.adminPaymentService.deletePayment(tenantId, paymentId);
  }
}
