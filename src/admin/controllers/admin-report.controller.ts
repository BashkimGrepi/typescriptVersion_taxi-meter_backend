import { 
  Controller, 
  Get, 
  Query, 
  Request,
  UseGuards,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UniversalV1Guard } from '../../auth/guards/universal-v1.guard';
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


@Controller('admin/reports')
@UseGuards(UniversalV1Guard, AdminRoleGuard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminReportController {
  constructor(
    private adminReportService: AdminReportService,
    private prisma: PrismaService
  ) {}

  @Get('revenue')
  async getRevenueReport(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
  ): Promise<RevenueReportResponse> {
    return this.adminReportService.getRevenueReport(query);
  }

  @Get('driver-performance')
  async getDriverPerformanceReport(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto
  ): Promise<DriverPerformanceResponse> {
    return this.adminReportService.getDriverPerformanceReport(query);
  }

  @Get('payment-methods')
  async getPaymentMethodReport(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
    @Request() req
  ): Promise<PaymentMethodReportResponse> {
    return this.adminReportService.getPaymentMethodReport(query);
  }

  @Get('summary')
  async getDashboardSummary(
    @Query(new ValidationPipe({ transform: true })) query: ReportsQueryDto,
    @Request() req
  ) {
    
    // Get all report data in parallel
    const [revenueReport, driverReport, paymentReport] = await Promise.all([
      this.adminReportService.getRevenueReport(query),
      this.adminReportService.getDriverPerformanceReport(query),
      this.adminReportService.getPaymentMethodReport(query)
    ]);

    // Calculate completion rate and other KPIs
    const { from, to } = query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const totalRidesIncludingCancelled = await this.prisma.ride.count({

      where: {
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
