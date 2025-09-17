import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { PricingService } from "./pricing.service";
import ListPricingPoliciesDto, { CreatePricingPolicyDto, UpdatePricingPolicyDto } from "./dto/pricing-policies.dto";
import { AdminOrManager, type AdminOrManagerInfo } from "src/decorators/admin-or-manager.decorator";
import { Admin, type AdminInfo } from "src/decorators/admin.decorator";
import { Driver, type DriverInfo } from "src/decorators/driver.decorator";
import { AuthenticatedUser, type AuthenticatedUserInfo } from "src/decorators/authenticated-user-decorator";
import { use } from "passport";



@UseGuards(JwtAuthGuard)
@Controller('pricing-policies')
export class PricingController {
    constructor(
        private readonly pricingService: PricingService 
    ) { }
    
    //list all policies - Admin & Manager can see all policies
    @Get()
    async listPolicies(@AuthenticatedUser() user: AuthenticatedUserInfo, @Query() dto: ListPricingPoliciesDto) {
        return this.pricingService.list(user.tenantId, dto);
    }

    //create new policy - Admin & Manager can create policies
    @Post()
    async create(@AdminOrManager() user: AdminOrManagerInfo, @Body() dto: CreatePricingPolicyDto) {
        return this.pricingService.create(user.tenantId, dto);
    }

    // PATCH /pricing/update/:id - Admin & Manager can update policies
    @Patch('update/:id')
    async update(
        @AdminOrManager() user: AdminOrManagerInfo,
        @Param('id') id: string,
        @Body() dto: UpdatePricingPolicyDto,
    ) {
        return this.pricingService.update(user.tenantId, id, dto);
    }

    // POST /pricing/:id/activate - Only Admin can activate policies (critical business operation)
    @Post(':id/activate')
    async activate(@Admin() admin: AdminInfo, @Param('id') id: string) {
        return this.pricingService.activate(admin.tenantId, id);
    }

    // GET /pricing/active/current - Anyone (Admin, Manager, Driver) can see active policy
    @Get('active/current')
    async active(@Req() req: any) {
        const tenantId = req.user.tenantId;
        return this.pricingService.getActive(tenantId);
    }

    // GET /pricing/active/driver - Drivers can see their current pricing
    @Get('active/driver')
    async activeForDriver(@AuthenticatedUser() user: AuthenticatedUserInfo) {
        return this.pricingService.getActive(user.tenantId);
    }


}