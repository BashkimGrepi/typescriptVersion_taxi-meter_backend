import { Injectable, ForbiddenException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "src/prisma/prisma.service";
import { Stripe } from "stripe";
import { randomBytes } from "crypto";
import { OAuthResponse, OAuthCompleteResponse } from "./interfaces/stripe-oauth-interface";
import { PaymentProvider, Role } from "@prisma/client";



@Injectable()
export class StripeService {
  constructor(private prisma: PrismaService) {}

    async initiateOAuth(tenantId: string, userId: string): Promise<OAuthResponse> {
      
        // Validate tenantId and userId
        const tenant = await this.prisma.tenant.findUnique({
            where: {
                id: tenantId
            }
        });

        if (!tenant || tenant.deletedAt) {
            throw new ForbiddenException('Inactive or missing tenant');
        }

    // Verify user has membership with required role
    const membership = await this.prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: userId,
            tenantId: tenantId
          },
          role: { in: [Role.ADMIN, Role.MANAGER] }
        }
    });

    if (!membership) {
      throw new ForbiddenException('You do not have permission to connect Stripe for this tenant');
    }

    // Generate a random nonce for CSRF security
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL
        
    // Store the state data in the database
    await this.prisma.oAuthState.create({
      data: {
            nonce,
            tenantId,
            userId,
            provider: PaymentProvider.STRIPE,
            expiresAt
      }
    });



    // Get environment variables
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    const redirectUri = process.env.STRIPE_CONNECT_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Missing Stripe OAuth configuration');
    }

    // Build Stripe OAuth URL
    const stripeOauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
    stripeOauthUrl.searchParams.set('response_type', 'code');
    stripeOauthUrl.searchParams.set('client_id', clientId);
    stripeOauthUrl.searchParams.set('scope', 'read_write');
    stripeOauthUrl.searchParams.set('redirect_uri', redirectUri);
    stripeOauthUrl.searchParams.set('state', nonce);

    return {
      redirectUrl: stripeOauthUrl.toString(),
      state: nonce,
      expiresAt
    };
  }

    
    
  async handleCallback(code: string, state: string): Promise<OAuthCompleteResponse> {
    // OAuth callback logic - TODO: Implement
    throw new Error('Not implemented yet');
  }

  async disconnectAccount(tenantId: string): Promise<void> {
    // Disconnect logic
  }
}