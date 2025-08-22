import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';


// Strategy for validating JWT tokens
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET') || 'default-secret-key',
    });
  }

    // Validates incoming JWT tokens and extracts user data
  async validate(payload: any) {
    // ---- 1) Driver tokens already carry tenant & driverProfile ----
    if (payload?.type === 'driver') {
      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role ?? 'DRIVER',
        tenantId: payload.tenantId,          // flattened
        driverProfileId: payload.driverProfileId,
        roles: payload.roles ?? [],          // optional, for completeness
      };
    }

    // ---- 2) Admin/regular user: fetch memberships ----
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });
    if (!user) return null;

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        tenantId: true,
        tenant: { select: { name: true } },
      },
    });

    const roles = memberships.map(m => ({
      role: m.role,
      tenantId: m.tenantId,
      tenantName: m.tenant.name,
    }));

    // ---- 3) Choose a tenantId for this request/token ----
    // precedence: tenantId in token (if you mint tenant-scoped tokens) -> single membership -> undefined
    let tenantId: string | undefined = payload.tenantId;
    if (!tenantId && memberships.length === 1) {
      tenantId = memberships[0].tenantId;
    }

    // ---- 4) Choose a role (prefer role for the chosen tenant, else ADMIN, else first) ----
    let role: string | undefined = payload.role;
    if (!role && tenantId) {
      role = memberships.find(m => m.tenantId === tenantId)?.role;
    }
    if (!role) {
      role = memberships.find(m => m.role === 'ADMIN')?.role ?? memberships[0]?.role ?? 'USER';
    }

    return {
      sub: user.id,
      email: user.email,
      role,
      tenantId,   // <-- flattened here; controllers can trust req.user.tenantId
      roles,
    };
  }
}