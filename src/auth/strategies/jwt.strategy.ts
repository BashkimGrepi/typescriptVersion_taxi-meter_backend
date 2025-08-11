import { Injectable } from '@nestjs/common';
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
      secretOrKey: configService.get('JWT_SECRET') || 'default-secret-key',
    });
  }

  async validate(payload: { sub: string; email: string; type?: string; role?: string; driverProfileId?: string; tenantId?: string; roles?: any[] }) {
    // If this is a driver token with type field, use the payload data
    if (payload.type === 'driver') {
      return {
        sub: payload.sub,
        email: payload.email,
        type: payload.type,
        role: payload.role,
        driverProfileId: payload.driverProfileId,
        tenantId: payload.tenantId
      };
    }
    
    // For regular users, fetch from database
    const user = await (this.prisma as any).user.findUnique({
      where: { id: payload.sub }
    });
    
    if (!user) return null;
    
    // Get memberships separately to avoid type issues
    const memberships = await (this.prisma as any).membership.findMany({
      where: { userId: user.id },
      include: { 
        tenant: true 
      }
    });
    
    return {
      id: user.id,
      email: user.email,
      roles: memberships.map(m => ({
        role: m.role,
        tenantId: m.tenantId,
        tenantName: m.tenant.name
      }))
    };
  }
}