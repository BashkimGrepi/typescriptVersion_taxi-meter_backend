import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AdminRoleGuard } from 'src/admin/guards/admin-role.guard';
import { UniversalV1Guard } from 'src/auth/guards/universal-v1.guard';
import { NewRidesService } from '../services/newRides-service';
import {
  GetRidesQueryDto,
  GetRidesResponseDto,
  RideDetailResponseDto,
} from '../dto/newRides-dto';

@ApiTags('Admin Rides V2')
@Controller('admin/rides-v2')
@UseGuards(UniversalV1Guard, AdminRoleGuard)
export class NewRidesController {
  constructor(private readonly service: NewRidesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get paginated rides with filters and summary',
    description:
      'Returns paginated ride list with cursor-based pagination, filtering, sorting, and aggregate summaries',
  })
  @ApiResponse({ status: 200, description: 'Rides retrieved successfully' })
  async getRidesList(
    @Query() query: GetRidesQueryDto,
  ): Promise<GetRidesResponseDto> {
    return this.service.getRidesList(query);
  }

  @Get(':rideId')
  @ApiOperation({
    summary: 'Get detailed ride information by ID',
    description:
      'Returns full ride details including driver, pricing policy, and payment information for admin audit/review',
  })
  @ApiParam({
    name: 'rideId',
    description: 'Unique ride identifier (UUID)',
    example: 'e3f2a5b8-1234-5678-90ab-cdef01234567',
  })
  @ApiResponse({
    status: 200,
    description: 'Ride details retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid ride ID format',
  })
  @ApiResponse({
    status: 404,
    description: 'Ride not found in your tenant',
  })
  async getRideById(
    @Param('rideId') rideId: string,
  ): Promise<RideDetailResponseDto> {
    return this.service.getRideById(rideId);
  }
}
