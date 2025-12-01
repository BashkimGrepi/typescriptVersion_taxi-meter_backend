import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { UniversalV1Guard } from "src/auth/guards/universal-v1.guard";
import { PricingService } from "./pricing.service";
import ListPricingPoliciesDto, { CreatePricingPolicyDto, UpdatePricingPolicyDto } from "./dto/pricing-policies.dto";
import { AdminOrManager, type AdminOrManagerInfo } from "src/decorators/admin-or-manager.decorator";
import { Admin, type AdminInfo } from "src/decorators/admin.decorator";
import { Driver, type DriverInfo } from "src/decorators/driver.decorator";
import { AuthenticatedUser, type AuthenticatedUserInfo } from "src/decorators/authenticated-user-decorator";
import { use } from "passport";
import * as FixedPricePolicyDto from "src/pricings/dto/FixedPricePolicyDto";
import * as CustomPricingPolicy from "./dto/CustomPricingPolicy";



@UseGuards(UniversalV1Guard)
@Controller('pricing-policies')
export class PricingController {
    constructor(
        private readonly pricingService: PricingService 
    ) { }
    
    //list all policies - Admin & Manager can see all policies
    // ------- METER  --------

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

    // --------- FIXED PRICE ----------
    // secure endpoints more for admin only and tighten the security
    @Post("/fixed/create/admin")
    async createFixedByAdmin(@AdminOrManager() user: AdminOrManagerInfo, @Body() dto: FixedPricePolicyDto.CreateFixedPricePolicyDto) {
        return this.pricingService.createFixedByAdmin(user.tenantId, dto);
    }

    @Get("/fixed")
    async listFixedPolicies(@AuthenticatedUser() user: AuthenticatedUserInfo ) {
        return this.pricingService.listFixedPolicies(user.tenantId, user.userId);
    }

    //@Post("/custom-fixed/driver")
    //async createCustomFixedByDriver(@Driver() driver: DriverInfo, @Body() dto: CustomPricingPolicy.CreateCustomFixedPolicyDto) {
      //  return this.pricingService.createCustomFixedByDriver(driver.tenantId, driver.driverProfileId, dto);
    //}



    // All policies
    @Get("all")
    async allPolicies(@AuthenticatedUser() user: AuthenticatedUserInfo) {
        const args = {
            tenantId: user.tenantId,
            userId: user.userId,
            userRole: user.role,
        };
        return this.pricingService.listAllPolicies(args);
    }

    @Get("available-ride")
    async availablePoliciesForRide(@Req() req: any) {
        const args = {
            tenantId: req.user.tenantId,
            userId: req.user.userId,
            userRole: req.user.role,
            driverProfileId: req.user.driverProfileId,
        };
        return this.pricingService.listAvailablePoliciesForRide(args);
    }
    
}