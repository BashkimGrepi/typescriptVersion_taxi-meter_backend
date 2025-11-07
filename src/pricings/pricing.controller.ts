import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { PricingService } from "./pricing.service";
import ListPricingPoliciesDto, { CreatePricingPolicyDto, UpdatePricingPolicyDto } from "./dto/pricing-policies.dto";



@UseGuards(JwtAuthGuard)
@Controller('pricing-policies')
export class PricingController {
    constructor(
        private readonly pricingService: PricingService 
    ) { }
    
    //list all policies - Admin & Manager can see all policies
    @Get()
    async listPolicies(@Query() dto: ListPricingPoliciesDto) {
        return this.pricingService.list(dto);
    }

    //create new policy - Admin & Manager can create policies
    @Post()
    async create(@Body() dto: CreatePricingPolicyDto) {
        return this.pricingService.create(dto);
    }

    // PATCH /pricing/update/:id - Admin & Manager can update policies
    @Patch('update/:id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdatePricingPolicyDto,
    ) {
        return this.pricingService.update(id, dto);
    }

    // POST /pricing/:id/activate - Only Admin can activate policies (critical business operation)
    @Post(':id/activate')
    async activate(@Param('id') id: string) {
        return this.pricingService.activate(id);
    }

    // GET /pricing/active/current - Anyone (Admin, Manager, Driver) can see active policy
    @Get('active/current')
    async active() {
        return this.pricingService.getActive();
    }

    // GET /pricing/active/driver - Drivers can see their current pricing
    @Get('active/driver')
    async activeForDriver() {
        return this.pricingService.getActive();
    }


}