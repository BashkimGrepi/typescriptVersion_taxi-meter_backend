import {
  Controller,
  Get,
  Query,
  Req,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AdminRoleGuard } from 'src/admin/guards/admin-role.guard';
import { UniversalV1Guard } from 'src/auth/guards/universal-v1.guard';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { BussinessStatusResponse } from '../dto/bussiness-status';

@Controller('admin/dashboard')
@UseGuards(UniversalV1Guard, AdminRoleGuard)
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  @Get('business-status')
  async getBussinessStatus(
    @Query(new ValidationPipe({ transform: true }))
    query: { period: 'all_time' | 'current_month' | 'today' },
    @Request() req,
    ): Promise<BussinessStatusResponse> {
    const tenantId = req.user.tenantId;
    return this.service.getBussinessStatus(tenantId, query);
    }
    


    @Get('revenue-overview')
    async getRevenueOverview(
        @Query(new ValidationPipe({ transform: true }))
        query: { period: 'all_time' | 'current_month' | 'today' },
        @Request() req,
    ) {
        const tenantId = req.user.tenantId;
        return this.service.getRevenueOverview(tenantId, query);
  }
  
  @Get('payment-summary')
  async getPaymentSummary(
    @Query(new ValidationPipe({ transform: true }))
    query: { period: 'all_time' | 'current_month' | 'today' },
    @Request() req,
  ) {
    const tenantId = req.user.tenantId;
    return this.service.getPaymentsSummary(tenantId, query);
  }


  @Get('live-operations')
  async getLiveOperations(
    @Request() req,
  ) {
    const tenantId = req.user.tenantId;
    return this.service.getLiveOperations(tenantId);
  }

  @Get('driver-activity')
  async getDriverActivity(
    @Request() req,
  ) {
    const tenantId = req.user.tenantId;
    return this.service.getDriverActivity(tenantId);
  }

  @Get('performance-trends')
  async getPerformanceTrends(
    @Request() req,
  ) {
    const tenantId = req.user.tenantId;
    return this.service.getPerformanceTrends(tenantId);
  }
}