 
import { Body, Controller, ForbiddenException, Injectable, Post, Req, UseGuards } from "@nestjs/common";
import { RideService } from "./ride.service";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { StartRideDto } from "./dto/StartRideDto";
import { StartRideResponseDto } from "./dto/StartRideResponseDto";
import { EndRideDto, EndRideResponseDto } from "./dto/EndRideDto";


@Injectable()
@Controller('rides')
    @UseGuards(JwtAuthGuard) // protects route and contains jwt authentication
export class RideController {
    constructor(
        private rideService: RideService,
        
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
}