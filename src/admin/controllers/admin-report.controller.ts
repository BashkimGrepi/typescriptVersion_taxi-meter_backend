import {
  Controller,
  Get,
  Query,
  Req,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { UniversalV1Guard } from '../../auth/guards/universal-v1.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../decorators/admin-role.decorator';
import { AdminReportService } from '../services/admin-report.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ReportsQueryDto,
  RevenueReportResponse,
  DriverPerformanceResponse,
  PaymentMethodReportResponse,
} from '../dto/report-admin.dto';

@Controller('admin/reports')
@UseGuards(UniversalV1Guard, AdminRoleGuard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminReportController {
  constructor(
    private adminReportService: AdminReportService,
    private prisma: PrismaService,
  ) {}

  @Get('revenue')
  async getRevenueReport(
    @Request() req,
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
  ): Promise<RevenueReportResponse> {
    const tenantId = req.user.tenantId;
    return this.adminReportService.getRevenueReport(tenantId, query);
  }

  @Get('driver-performance')
  async getDriverPerformanceReport(
    @Request() req,
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
  ): Promise<DriverPerformanceResponse> {
    const tenantId = req.user.tenantId;
    return this.adminReportService.getDriverPerformanceReport(tenantId, query);
  }

  @Get('payment-methods')
  async getPaymentMethodReport(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
    @Request() req,
  ): Promise<PaymentMethodReportResponse> {
    const tenantId = req.user.tenantId;
    return this.adminReportService.getPaymentMethodReport(tenantId, query);
  }

  @Get('summary')
  async getDashboardSummary(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
    @Request() req,
  ) {
    const tenantId = req.user.tenantId;
    return this.adminReportService.getDashboardSummary(tenantId, query);
  }
}
