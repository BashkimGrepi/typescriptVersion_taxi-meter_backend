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
import { UniversalV1Guard } from '../../auth/guards/universal-v1.guard';
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
@UseGuards(UniversalV1Guard) // can be removed if global guard is set. ->  it is now
@AdminRoles('ADMIN', 'MANAGER')
export class AdminDriverController {
  constructor(private adminDriverService: AdminDriverService) {}

  @Get()
  async getDrivers(
    @Query(new ValidationPipe({ transform: true })) query: DriversQueryDto,
    @Request() req
  ): Promise<DriversPageResponse> {
    const tenantId = req.user.tenantId;
    return this.adminDriverService.getDrivers(tenantId, query);
  }

  @Post("create")
  async createDriver(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) 
    createDriverDto: CreateDriverDto,
    @Request() req
  ): Promise<DriverResponseDto> {
    const tenantId = req.user.tenantId;
    return this.adminDriverService.createDriver(tenantId, createDriverDto);
  }

  @Patch(':id')
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