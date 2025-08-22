import { 
  Controller, 
  Get, 
  Query, 
  Request,
  UseGuards,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../decorators/admin-role.decorator';
import { AdminReportService } from '../services/admin-report.service';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  ReportsQueryDto,
  RevenueReportResponse,
  DriverPerformanceResponse,
  PaymentMethodReportResponse
} from '../dto/report-admin.dto';

@ApiTags('admin-reports')
@ApiBearerAuth('JWT-auth')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminReportController {
  constructor(
    private adminReportService: AdminReportService,
    private prisma: PrismaService
  ) {}

  @Get('revenue')
  @ApiOperation({
    summary: 'Get revenue report (Admin/Manager)',
    description: 'Get revenue analytics with time-series data for the current tenant'
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO string)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO string)' })
  @ApiQuery({ name: 'driverId', required: false, description: 'Filter by driver profile ID' })
  @ApiQuery({ name: 'granularity', required: false, enum: ['daily', 'weekly', 'monthly'], example: 'daily' })
  @ApiResponse({
    status: 200,
    description: 'Revenue report retrieved successfully',
    type: RevenueReportResponse
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async getRevenueReport(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
    @Request() req
  ): Promise<RevenueReportResponse> {
    const tenantId = req.user.tenantId;
    return this.adminReportService.getRevenueReport(tenantId, query);
  }

  @Get('driver-performance')
  @ApiOperation({
    summary: 'Get driver performance report (Admin/Manager)',
    description: 'Get driver performance analytics and fleet summary for the current tenant'
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO string)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO string)' })
  @ApiResponse({
    status: 200,
    description: 'Driver performance report retrieved successfully',
    type: DriverPerformanceResponse
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async getDriverPerformanceReport(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
    @Request() req
  ): Promise<DriverPerformanceResponse> {
    const tenantId = req.user.tenantId;
    return this.adminReportService.getDriverPerformanceReport(tenantId, query);
  }

  @Get('payment-methods')
  @ApiOperation({
    summary: 'Get payment method report (Admin/Manager)',
    description: 'Get payment method breakdown and statistics for the current tenant'
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO string)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO string)' })
  @ApiResponse({
    status: 200,
    description: 'Payment method report retrieved successfully',
    type: PaymentMethodReportResponse
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async getPaymentMethodReport(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
    @Request() req
  ): Promise<PaymentMethodReportResponse> {
    const tenantId = req.user.tenantId;
    return this.adminReportService.getPaymentMethodReport(tenantId, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get dashboard summary (Admin/Manager)',
    description: 'Get key metrics and KPIs for dashboard display'
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO string)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO string)' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        period: { type: 'string', example: '2024-01-01 to 2024-01-31' },
        totalRides: { type: 'number', example: 450 },
        totalRevenue: { type: 'string', example: '12505.75' },
        totalDistance: { type: 'string', example: '4235.8' },
        avgFarePerRide: { type: 'string', example: '27.79' },
        activeDrivers: { type: 'number', example: 15 },
        completionRate: { type: 'string', example: '94.2' },
        paymentRate: { type: 'string', example: '96.5' },
        topDriver: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'John Doe' },
            rides: { type: 'number', example: 89 },
            revenue: { type: 'string', example: '2456.50' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async getDashboardSummary(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
    @Request() req
  ) {
    const tenantId = req.user.tenantId;
    
    // Get all report data in parallel
    const [revenueReport, driverReport, paymentReport] = await Promise.all([
      this.adminReportService.getRevenueReport(tenantId, query),
      this.adminReportService.getDriverPerformanceReport(tenantId, query),
      this.adminReportService.getPaymentMethodReport(tenantId, query)
    ]);

    // Calculate completion rate and other KPIs
    const { from, to } = query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const totalRidesIncludingCancelled = await this.prisma.ride.count({
      where: {
        tenantId,
        startedAt: { gte: fromDate, lte: toDate }
      }
    });

    const completedRides = revenueReport.summary.totalRides;
    const completionRate = totalRidesIncludingCancelled > 0 
      ? ((completedRides / totalRidesIncludingCancelled) * 100).toFixed(1)
      : '0';

    // Find top performing driver
    const topDriver = driverReport.drivers.length > 0 
      ? driverReport.drivers[0]
      : null;

    return {
      period: revenueReport.period,
      totalRides: revenueReport.summary.totalRides,
      totalRevenue: revenueReport.summary.totalRevenue,
      totalDistance: revenueReport.summary.totalDistanceKm,
      avgFarePerRide: revenueReport.summary.avgFarePerRide,
      activeDrivers: driverReport.fleetSummary.activeDrivers,
      completionRate,
      paymentRate: paymentReport.summary.paymentRate,
      topDriver: topDriver ? {
        name: `${topDriver.firstName} ${topDriver.lastName}`,
        rides: topDriver.rideCount,
        revenue: topDriver.totalRevenue
      } : null
    };
  }
}
