 
import { Body, Controller, ForbiddenException, Get, Injectable, Param, Post, Query, Req, Request, UseGuards } from "@nestjs/common";
import { DriverRideService } from "../services/driver-ride.service";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { StartRideDto } from "../dto/StartRideDto";
import { StartRideResponseDto } from "../dto/StartRideResponseDto";
import { EndRideDto, EndRideResponseDto } from "../dto/EndRideDto";
import * as RideHistoryDto from "../dto/RideHistoryDto";


@Injectable()
@Controller('driver/rides')
    @UseGuards(JwtAuthGuard) // protects route and contains jwt authentication
export class DriverRideController {
    constructor(
        private rideService: DriverRideService,
        
    ) { }
    
    @Post('start')
    async startRide(@Body() dto: StartRideDto, @Req() req): Promise<StartRideResponseDto>{
        const userId = req.user.sub;
        const tenantId = req.user.tenantId;
        console.log('req.user = ', req.user);

        if (req.user.role !== 'DRIVER') {
            throw new ForbiddenException('Only drivers can start rides');
        }

        return this.rideService.startRide({ dto, userId, tenantId });
    }


    @Post('end')
    async endRide(@Body() dto: EndRideDto, @Req() req): Promise<EndRideResponseDto> {
        const userId = req.user.sub;
        const tenantId = req.user.tenantId;

        if (req.user.role !== 'DRIVER') {
            throw new ForbiddenException('Only drivers can end rides');
        }

        return this.rideService.endRide({ dto, userId, tenantId });
    }

    @Get('today-summary')
    async getTodaysSummary(@Request() req: any) {
        return this.rideService.getTodaysSummary({
            userId: req.user.sub,
            tenantId: req.user.tenantId
        });
    }


    @Get('history')
  async getRideHistory(
    @Request() req: any,
    @Query() query: RideHistoryDto.RideHistoryRequestDto
  ) {
    return this.rideService.getRideHistory({
      userId: req.user.sub,
      tenantId: req.user.tenantId,
      dto: {
        timeFilter: query.timeFilter || 'week',
        page: query.page ? parseInt(query.page.toString()) : 1,
        limit: query.limit ? parseInt(query.limit.toString()) : 20
      }
    });
  }

  @Get(':rideId/details')
  async getRideDetails(
    @Request() req: any,
    @Param('rideId') rideId: string
  ) {
    return this.rideService.getRideDetails({
      userId: req.user.sub,
      tenantId: req.user.tenantId,
      rideId
    });
  }
}