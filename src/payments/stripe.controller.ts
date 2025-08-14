import { Controller, Get, Query, Request, ForbiddenException, BadRequestException, UseGuards, } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { JwtPayload } from "src/payments/interfaces/jwt-payload.interface";
import { StripeService } from "./stripe.service";
import { OAuthResponse } from "./interfaces/stripe-oauth-interface";


@Controller("stripe")
@UseGuards(JwtAuthGuard) //protects route and contains JWT authentication
export class StripeController {

    constructor(
        private stripeService: StripeService
    ) { }
    
    @Get("connect/start")
    async startOAuth(
        @Query('tenantId') tenantId: string,
        @Request() req: { user: JwtPayload} 
    ): Promise<OAuthResponse> {
        const userId = req.user.sub;
        
        // Basic validation
        if (!tenantId || !userId) {
            throw new BadRequestException('Missing required parameters');
        }
        
        // Check user has access to this tenant (JWT level validation)
        const tenantRole = req.user.roles.find(role => role.tenantId === tenantId);
        if (!tenantRole) {
            throw new ForbiddenException('You do not have access to this tenant');
        }

        if (!['ADMIN', 'MANAGER'].includes(tenantRole.role)) {
            throw new ForbiddenException('Insufficient permissions - Need ADMIN or MANAGER role');
        }

        // Delegate business logic to service
        return this.stripeService.initiateOAuth(tenantId, userId);
    }
}