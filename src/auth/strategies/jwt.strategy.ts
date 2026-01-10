import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Use the same JWT_SECRET as the module for consistency
      secretOrKey: configService.get('JWT_SECRET') || 'default-access-secret',
      // (optional) audience: 'api',
    });
  }

  async validate(payload: any) {
    // 1) Reject anything that isn't a real access token
    if (!payload.tenantId || !payload.sub || payload?.type !== 'access') {
      throw new UnauthorizedException('Invalid token structure');
    }

    // verify user still exists and tenant consistency
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        tenantId: true,
        role: true,
        status: true,
      }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException('User not found or inactive');
    }

    // CRITICAL: ensure token's tenantId matches user's current tenantId
    if (user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Token Tenant mismatch - security violation');
    }

    return {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      ...(payload.driverProfileId && { driverProfileId: payload.driverProfileId }),
    };
  }
}
