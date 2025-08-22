import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Param, 
  Body, 
  Query, 
  Request,
  UseGuards,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../decorators/admin-role.decorator';
import { AdminDriverService } from '../services/admin-driver.service';
import { 
  CreateDriverDto, 
  UpdateDriverDto, 
  DriversQueryDto, 
  DriverResponseDto,
  DriversPageResponse 
} from '../dto/driver-admin.dto';

@ApiTags('admin-drivers')
@ApiBearerAuth('JWT-auth')
@Controller('admin/drivers')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminDriverController {
  constructor(private adminDriverService: AdminDriverService) {}

  @Get()
  @ApiOperation({
    summary: 'List drivers (Admin/Manager)',
    description: 'Get paginated list of drivers for the current tenant with optional search and filtering'
  })
  @ApiQuery({ name: 'q', required: false, description: 'Search term for firstName, lastName, phone' })
  @ApiQuery({ name: 'status', required: false, enum: ['INVITED', 'ACTIVE', 'INACTIVE', 'ALL'] })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Items per page', example: 25 })
  @ApiResponse({
    status: 200,
    description: 'Drivers retrieved successfully',
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
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              phone: { type: 'string' },
              userId: { type: 'string' },
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
  async getDrivers(
    @Query(new ValidationPipe({ transform: true })) query: DriversQueryDto,
    @Request() req
  ): Promise<DriversPageResponse> {
    const tenantId = req.user.tenantId;
    return this.adminDriverService.getDrivers(tenantId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create driver (Admin/Manager)',
    description: 'Create a new driver profile for the current tenant'
  })
  @ApiResponse({
    status: 201,
    description: 'Driver created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        userId: { type: 'string' },
        status: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async createDriver(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) 
    createDriverDto: CreateDriverDto,
    @Request() req
  ): Promise<DriverResponseDto> {
    const tenantId = req.user.tenantId;
    return this.adminDriverService.createDriver(tenantId, createDriverDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update driver (Admin/Manager)',
    description: 'Update an existing driver profile. Only drivers from the current tenant can be updated.'
  })
  @ApiParam({ name: 'id', description: 'Driver profile ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @ApiResponse({
    status: 200,
    description: 'Driver updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        userId: { type: 'string' },
        status: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async updateDriver(
    @Param('id') driverId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) 
    updateDriverDto: UpdateDriverDto,
    @Request() req
  ): Promise<DriverResponseDto> {
    const tenantId = req.user.tenantId;
    return this.adminDriverService.updateDriver(tenantId, driverId, updateDriverDto);
  }
}
