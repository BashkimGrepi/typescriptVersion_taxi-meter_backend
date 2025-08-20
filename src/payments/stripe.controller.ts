import { Controller, Get, Query, Request, ForbiddenException, BadRequestException, UseGuards, } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { JwtPayload } from "src/payments/interfaces/jwt-payload.interface";
import { StripeService } from "./stripe.service";
import { OAuthCompleteResponse, OAuthResponse } from "./interfaces/stripe-oauth-interface";


@ApiTags('Stripe Connect OAuth')
@ApiBearerAuth('JWT-auth')
@Controller("stripe")
@UseGuards(JwtAuthGuard) //protects route and contains JWT authentication
export class StripeController {

    constructor(
        private stripeService: StripeService
    ) { }
    
    @Get("connect/start")
    @ApiOperation({
        summary: 'Start Stripe Connect OAuth flow',
        description: 'Initiates the Stripe Connect OAuth flow for a tenant admin/manager to connect their Stripe account'
    })
    @ApiQuery({ name: 'tenantId', description: 'The tenant ID to connect Stripe account for', type: 'string' })
    @ApiResponse({
        status: 200,
        description: 'OAuth URL generated successfully',
        schema: {
            type: 'object',
            properties: {
                authUrl: { type: 'string', description: 'Stripe OAuth authorization URL' }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Missing required parameters' })
    @ApiResponse({ status: 403, description: 'Insufficient permissions or no access to tenant' })
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

    @Get("connect/stripe/callback")
    @ApiOperation({
        summary: 'Handle Stripe Connect OAuth callback',
        description: 'Handles the OAuth callback from Stripe after user authorization, exchanges code for access token'
    })
    @ApiQuery({ name: 'code', description: 'Authorization code from Stripe', type: 'string', required: false })
    @ApiQuery({ name: 'state', description: 'CSRF protection state parameter', type: 'string' })
    @ApiQuery({ name: 'error', description: 'Error code if authorization failed', type: 'string', required: false })
    @ApiQuery({ name: 'error_description', description: 'Human-readable error description', type: 'string', required: false })
    @ApiResponse({
        status: 200,
        description: 'OAuth callback processed successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                accountId: { type: 'string', description: 'Connected Stripe account ID' }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid state, missing parameters, or OAuth error' })
    @ApiResponse({ status: 403, description: 'State validation failed or insufficient permissions' })
    async handleCallback(
        @Query("code") code: string,
        @Query("state") state: string,
        @Query("error") error?: string,
        @Query("error_description") errorDescription?: string
    ): Promise<OAuthCompleteResponse> {
        
        return this.stripeService.handleCallback(code, state, error, errorDescription);
    }
}