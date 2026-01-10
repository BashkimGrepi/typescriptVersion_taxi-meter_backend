import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DriverRideService } from '../services/driver-ride.service';
import { UniversalV1Guard } from 'src/auth/guards/universal-v1.guard';
import { StartRideDto } from '../dto/StartRideDto';
import { StartRideResponseDtoNew } from '../dto/StartRideResponseDto';
import { EndRideDto, EndRideResponseDto } from '../dto/EndRideDto';
import * as RideHistoryDto from '../dto/RideHistoryDto';

@Injectable()
@Controller('driver/rides')
@UseGuards(UniversalV1Guard) // protects route and contains jwt authentication
export class DriverRideController {
  constructor(private rideService: DriverRideService) {}

  @Post('start')
  async startRide(
    @Body() dto: StartRideDto,
    @Req() req,
): Promise<StartRideResponseDtoNew> {
    if (req.user.role !== 'DRIVER') {
      throw new ForbiddenException('Only drivers can start rides');
    }

    return this.rideService.startRide({ dto });
  }

  @Post('end')
  async endRide(
    @Body() dto: EndRideDto,
    @Req() req,
  ): Promise<EndRideResponseDto> {
    if (req.user.role !== 'DRIVER') {
      throw new ForbiddenException('Only drivers can end rides');
    }

    return this.rideService.endRide({ dto });
  }

  @Get('today-summary')
  async getTodaysSummary(@Request() req: any) {
    return this.rideService.getTodaysSummary();
  }

  @Get('history')
  async getRideHistory(
    @Request() req: any,
    @Query() query: RideHistoryDto.RideHistoryRequestDto,
  ) {
    return this.rideService.getRideHistory({
      dto: {
        timeFilter: query.timeFilter || 'week',
        page: query.page ? parseInt(query.page.toString()) : 1,
        limit: query.limit ? parseInt(query.limit.toString()) : 20,
      },
    });
  }

  @Get(':rideId/details')
  async getRideDetails(@Request() req: any, @Param('rideId') rideId: string) {
    return this.rideService.getRideDetails({rideId});
  }
}
