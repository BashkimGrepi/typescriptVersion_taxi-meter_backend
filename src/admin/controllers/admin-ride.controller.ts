import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UniversalV1Guard } from 'src/auth/guards/universal-v1.guard';
import { AdminRoles } from '../decorators/admin-role.decorator';
import { AdminRideService } from '../services/admin-ride.service';
import { RidesQueryDto } from '../dto/ride-admin.dto';

@Controller('admin/rides')
@UseGuards(UniversalV1Guard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminRideController {
  constructor(private readonly adminRideService: AdminRideService) {}

  @Get()
  async getRides(@Request() req, @Query() query: RidesQueryDto) {
    const tenantId = req.user.tenantId;
    return this.adminRideService.getRides(tenantId, query);
  }

  @Get(':id/summary')
  async getRideSummary(@Request() req, @Param('id') rideId: string) {
    const tenantId = req.user.tenantId;
    return this.adminRideService.getRideById(tenantId, rideId);
  }
}
