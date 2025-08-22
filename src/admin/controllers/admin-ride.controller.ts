import { 
  Controller, 
  Get, 
  Param, 
  Query, 
  Request,
  UseGuards,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../decorators/admin-role.decorator';
import { AdminRideService } from '../services/admin-ride.service';
import { RidesQueryDto, RideResponseDto, RidesPageResponse } from '../dto/ride-admin.dto';

@ApiTags('admin-rides')
@ApiBearerAuth('JWT-auth')
@Controller('admin/rides')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminRideController {
  constructor(private adminRideService: AdminRideService) {}

  @Get()
  @ApiOperation({
    summary: 'List rides (Admin/Manager)',
    description: 'Get paginated list of rides for the current tenant with optional filters'
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO string)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO string)' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ALL'] })
  @ApiQuery({ name: 'driverId', required: false, description: 'Filter by driver profile ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Items per page', example: 25 })
  @ApiResponse({
    status: 200,
    description: 'Rides retrieved successfully',
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
              driverProfileId: { type: 'string' },
              startedAt: { type: 'string' },
              endedAt: { type: 'string' },
              durationMin: { type: 'string' },
              distanceKm: { type: 'string' },
              fareSubtotal: { type: 'string' },
              taxAmount: { type: 'string' },
              fareTotal: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string' }
            }
          }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async getRides(
    @Query(new ValidationPipe({ transform: true })) query: RidesQueryDto,
    @Request() req
  ): Promise<RidesPageResponse> {
    const tenantId = req.user.tenantId;
    return this.adminRideService.getRides(tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get ride by ID (Admin/Manager)',
    description: 'Get detailed information about a specific ride'
  })
  @ApiParam({ name: 'id', description: 'Ride ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @ApiResponse({
    status: 200,
    description: 'Ride retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        driverProfileId: { type: 'string' },
        startedAt: { type: 'string' },
        endedAt: { type: 'string' },
        durationMin: { type: 'string' },
        distanceKm: { type: 'string' },
        fareSubtotal: { type: 'string' },
        taxAmount: { type: 'string' },
        fareTotal: { type: 'string' },
        status: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  @ApiResponse({ status: 404, description: 'Ride not found' })
  async getRideById(
    @Param('id') rideId: string,
    @Request() req
  ): Promise<RideResponseDto> {
    const tenantId = req.user.tenantId;
    return this.adminRideService.getRideById(tenantId, rideId);
  }
}
