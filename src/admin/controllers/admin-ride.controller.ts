import { Controller, Get, Param, Query } from "@nestjs/common";
import { AdminRideService } from "../services/admin-ride.service";
import { RideResponseDto, RidesPageResponse, RidesQueryDto } from "../dto/ride-admin.dto";

@Controller('admin/rides')
export class AdminRideController {
    constructor (private adminRideService: AdminRideService) {}

    @Get()
    async getRides(@Query() query: RidesQueryDto): Promise<RidesPageResponse> {
        return this.adminRideService.getRides(query);
    }

    @Get(':id')
    async getRideById(@Param('id') id: string): Promise<RideResponseDto> {
        return this.adminRideService.getRideById(id);
    }
}