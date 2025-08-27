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
    if (payload?.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // compatibility: accept legacy driver tokens
    if (payload?.type === 'driver') {
      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role ?? 'DRIVER',
        tenantId: payload.tenantId,
        driverProfileId: payload.driverProfileId,
      };
    }

    // 2) Fast-path: tenant-scoped access token already carries what we need
    // We expect: sub, email (optional), tenantId, role
    if (payload?.tenantId && payload?.role) {
      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,           // 'ADMIN' | 'MANAGER' | 'DRIVER'
        tenantId: payload.tenantId,   // tenant scoped!
        // keep a compact roles field if you like, or omit it
      };
    }

    // 3) Fallback (rare): old tokens without tenantId/role → derive from DB
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        tenantId: true,
        tenant: { select: { name: true } },
      },
    });
    if (!memberships.length) throw new UnauthorizedException('No memberships');

    // choose a tenant deterministically
    const chosen = memberships[0];
    return {
      sub: user.id,
      email: user.email,
      role: chosen.role,
      tenantId: chosen.tenantId,
      roles: memberships.map(m => ({
        role: m.role,
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
      })),
    };
  }
}
