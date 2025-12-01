import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtRevocationService } from '../services/jwt-revocation.service';
import {
  UnifiedJwtPayload,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtV1Strategy extends PassportStrategy(Strategy, 'jwt-v1') {
  private readonly logger = new Logger(JwtV1Strategy.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private jwtRevocationService: JwtRevocationService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in configuration');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      audience: 'api',
    });
  }

  async validate(payload: UnifiedJwtPayload) {
    this.logger.log(
      `JWT validation for user: ${payload.sub}, role: ${payload.role}, tenant: ${payload.tenantId}`,
    );

    // 1. Validate payload structure
    this.validatePayloadStructure(payload);

    // 2. Check token revocation
    if (
      payload.jti &&
      (await this.jwtRevocationService.isTokenRevoked(payload.jti))
    ) {
      this.logger.warn(
        `Token revoked for user: ${payload.sub}, jti: ${payload.jti}`,
      );
      throw new UnauthorizedException('Token has been revoked');
    }

    // 3. Check user-level revocation (lost device)
    if (
      await this.jwtRevocationService.isUserRevoked(payload.sub, payload.iat)
    ) {
      throw new UnauthorizedException('User tokens have been revoked');
    }

    // 4. Validate role-specific requirements and mutable state
    if (payload.role === 'DRIVER') {
      await this.validateDriverStatus(
        payload.sub,
        payload.driverProfileId!,
        payload.tenantId,
      );
    } else {
      // For ADMIN/MANAGER roles
      await this.validateAdminManagerStatus(
        payload.sub,
        payload.role,
        payload.tenantId,
      );
    }

    this.logger.log(
      `JWT validation successful for user: ${payload.sub}, role: ${payload.role}`,
    );

    // Return standardized user object for request.user
    return {
      sub: payload.sub,
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      tenantName: payload.tenantName,
      driverProfileId: payload.driverProfileId, // Will be undefined for non-driver roles
      type: payload.type,
      jti: payload.jti,
    };
  }

  private validatePayloadStructure(payload: any): void {
    const errors: string[] = [];

    // Validate token structure
    if (payload?.type !== 'access') {
      errors.push(
        `Invalid token type: expected 'access', got ${payload?.type}`,
      );
    }

    if (!payload.ver || payload.ver !== 1) {
      errors.push(`Invalid token version: expected 1, got ${payload.ver}`);
    }

    if (
      !payload.role ||
      !['ADMIN', 'MANAGER', 'DRIVER'].includes(payload.role)
    ) {
      errors.push(
        `Invalid role: expected ADMIN/MANAGER/DRIVER, got ${payload.role}`,
      );
    }

    if (!payload.sub || !payload.email || !payload.tenantId || !payload.jti) {
      errors.push('Missing required claims (sub, email, tenantId, jti)');
    }

    // Role-specific validation
    if (payload.role === 'DRIVER' && !payload.driverProfileId) {
      errors.push('Missing driverProfileId for DRIVER role');
    }

    if (errors.length > 0) {
      this.logger.error(`JWT payload validation errors: ${errors.join('; ')}`);
      throw new UnauthorizedException('Invalid token structure');
    }
  }

  private async validateDriverStatus(
    userId: string,
    driverProfileId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      // Validate user exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });

      if (!user) throw new UnauthorizedException('User not found');
      if (user.status !== 'ACTIVE')
        throw new UnauthorizedException('User is not active');

      // Validate driver profile exists, is active, and belongs to correct user and tenant
      const driverProfile = await this.prisma.driverProfile.findUnique({
        where: { id: driverProfileId },
        select: {
          status: true,
          tenantId: true,
          userId: true,
        },
      });

      if (!driverProfile)
        throw new UnauthorizedException('Driver profile not found');
      if (driverProfile.status !== 'ACTIVE')
        throw new UnauthorizedException('Driver profile is not active');
      if (driverProfile.tenantId !== tenantId)
        throw new UnauthorizedException('Driver profile tenant mismatch');
      if (driverProfile.userId !== userId)
        throw new UnauthorizedException('Driver profile user mismatch');
    } catch (error) {
      this.logger.error(
        `Database error during driver validation for userId: ${userId}`,
        error.stack,
      );
      throw new UnauthorizedException('Error validating driver status');
    }
  }

  private async validateAdminManagerStatus(
    userId: string,
    role: 'ADMIN' | 'MANAGER',
    tenantId: string,
  ): Promise<void> {
    try {
      // Validate user exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });

      if (!user) throw new UnauthorizedException('User not found');
      if (user.status !== 'ACTIVE')
        throw new UnauthorizedException('User is not active');

      // Validate membership exists for this user, role, and tenant
      const membership = await this.prisma.membership.findFirst({
        where: {
          userId: userId,
          tenantId: tenantId,
          role: role,
        },
        select: { id: true },
      });

      if (!membership) {
        throw new UnauthorizedException(
          `User membership not found for role ${role} in tenant ${tenantId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Database error during admin/manager validation for userId: ${userId}`,
        error.stack,
      );
      throw new UnauthorizedException('Error validating admin/manager status');
    }
  }
}
