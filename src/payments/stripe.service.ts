import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "src/prisma/prisma.service";
import { Stripe } from "stripe";
import { randomBytes } from "crypto";
import { OAuthResponse, OAuthCompleteResponse } from "./interfaces/stripe-oauth-interface";
import { PaymentProvider, Role } from "@prisma/client";
import { stat } from "fs";
import { ref } from "process";



@Injectable()
export class StripeService {
  constructor(private prisma: PrismaService) {}

    async initiateOAuth(tenantId: string, userId: string): Promise<OAuthResponse> {
      
        // Validate tenantId and userId
        await this.validateUserPermissions(userId, tenantId);

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
            expiresAt: expiresAt
        };
    }

    
    
  async handleCallback(code: string, state: string, error?: string, errorDescription?: string): Promise<OAuthCompleteResponse> {

        // handle stripe error early (or user cancellation, etc)
        // security first: check for csrf (missing state)
        if (!state) {
          console.error('Missing state parameter');
          throw new ForbiddenException("Missing state parameter - potential CSRF attack");
        }

      // user canellation: 
      if (error) {
          console.log(`User cancelled OAuth flow: ${error} - ${errorDescription}`);
          // clear stored state
          await this.cleanupOAuthState(state);
          return {
              success: false,
              accountId: '',
              livemode: false,
              scope: '',
              connectedAt: new Date(),
              message: `Connection cancelled: ${errorDescription || error}`,
            };
        }

      // Missing required code
      if (!code) {
          console.error('Missing authorization code in callback');
          throw new BadRequestException('Missing authorization code');
      }

      // Continue logic here
      try {
            //look up the OAuth state in db
            const oauthRecord = await this.prisma.oAuthState.findFirst({
                where: {
                    nonce: state, 
                    provider: PaymentProvider.STRIPE,
                    consumed: false
                }
            });

            // validate the record exists
            if (!oauthRecord) {
                console.error('Invalid OAuth state - no matching record found', {
                    nonce: state.substring(0, 8) + "...",
                    provider: PaymentProvider.STRIPE
                });
                throw new ForbiddenException('Invalid OAuth state - potential security violation');
            }

            // check state expiration
            if (oauthRecord.expiresAt < new Date()) {
                console.error('OAuth state expired');
                await this.cleanupOAuthState(state);
                throw new BadRequestException('OAuth session expired - please try connecting again');
            }

            const userId = oauthRecord.userId;
            const tenantId = oauthRecord.tenantId;
            // re-validate permission using validateUserPermissions
            await this.validateUserPermissions(userId, tenantId);

            // mark state as consumed to prevent replay attacks
            await this.prisma.oAuthState.update({
              where: { id: oauthRecord.id },
              data: { consumed: true }
            });

            // stripe token exchange 
            const tokenResponse = await fetch('https://connect.stripe.com/oauth/token', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  code: code,
                  client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
                  client_secret: process.env.STRIPE_CONNECT_CLIENT_SECRET!,
                  redirect_uri: process.env.STRIPE_CONNECT_REDIRECT_URI!,
              })
            });

          const tokenData = await tokenResponse.json();
          if (!tokenResponse.ok) {
              const errorType = tokenData.error;
              const errorDescription = tokenData.error_description;

              console.error('Stripe token exchange failed', {
                  status: tokenResponse.status,
                  error: errorType,
                  description: errorDescription,
              });

              // Handle specific Stripe errors
                if (errorType === 'invalid_grant') {
                    throw new BadRequestException('Authorization code expired or invalid');
                } else if (errorType === 'invalid_client') {
                    throw new BadRequestException('Invalid client configuration');
                } else {
                    throw new BadRequestException(`Stripe error: ${errorDescription || errorType || 'Unknown error'}`);
                }
          }

          if (!tokenData.stripe_user_id || !tokenData.access_token) {
              console.error('Stripe response missing required fields', tokenData);
              throw new BadRequestException('Invalid response from Stripe');
          }

          // Continue with the successful token exchange flow
            const stripeAccountId = tokenData.stripe_user_id;
            const accessToken = tokenData.access_token;
            const refreshToken = tokenData.refresh_token;
            const scope = tokenData.scope || 'read_write'; // Default to read_write if not provided
            const livemode = tokenData.livemode || false;
          
          await this.prisma.providerAccount.upsert({
              where: {
                  tenantId_provider: {
                      tenantId: tenantId,
                      provider: PaymentProvider.STRIPE
                  }
              },
              update: {
                  externalAccountId: stripeAccountId,
                  accessTokenEnc: accessToken,
                  refreshTokenEnc: refreshToken,
                  scope: scope,
                  livemode: livemode,
                  connectedAt: new Date(),
                  metadataJson: {
                      originalResponse: tokenData,
                      connectedBy: userId,
                      connectedAt: new Date().toISOString()
                  }
              },
              create: {
                  // create new connection
                  tenantId: tenantId,
                  provider: PaymentProvider.STRIPE,
                  externalAccountId: stripeAccountId,
                  accessTokenEnc: accessToken,  // TODO: Encrypt this
                  refreshTokenEnc: refreshToken, // TODO: Encrypt this
                  scope: scope,
                  livemode: livemode,
                  connectedAt: new Date(),
                  metadataJson: {
                      originalResponse: tokenData,
                      connectedBy: userId,
                      connectedAt: new Date().toISOString()
                  }
              }
          });

          return {
              success: true,
              accountId: stripeAccountId,
              livemode: livemode,
              scope: scope,
              connectedAt: new Date(),
              message: 'Stripe account connected successfully'
          }
          

        } catch (error) {
            console.error('OAuth callback failed:', error);
            
            if (error instanceof ForbiddenException || error instanceof BadRequestException) {
                throw error; // Re-throw our own exceptions
            }
            
            throw new BadRequestException('Failed to complete Stripe connection');
        }

    }

    // Helper methods for OAuth implementation
    // Clean up OAuth state
    private async cleanupOAuthState(state: string) {
        try {
            await this.prisma.oAuthState.deleteMany({
                where: {
                    nonce: state
                }
            });
        } catch (error) {
            console.error('Error cleaning up OAuth state:', error);
        }
    }

    // Disconnect user account from Stripe
    private async disconnectAccount(tenantId: string): Promise<void> {
    // Disconnect logic
    }
    
    // Validate user permissions for Stripe connection
    private async validateUserPermissions(userId: string, tenantId: string): Promise<void> {
        const tenant = await this.prisma.tenant.findUnique({
            where: {
                id: tenantId
            }
        });
        if (!tenant || tenant.deletedAt) {
            throw new ForbiddenException('Inactive or missing tenant');
        }

        // verify user has membership with required role
        const membership = await this.prisma.membership.findUnique({
            where: {
                userId_tenantId: {
                    userId,
                    tenantId
                },
                role: { in: [Role.ADMIN, Role.MANAGER] }     // ✅ Correct placement
            }
        });
        if (!membership) {
            throw new ForbiddenException('You do not have permission to connect Stripe');
        }
    }
}