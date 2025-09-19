import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtRevocationService } from '../services/jwt-revocation.service';
import {
  DriverAccessJwtPayloadV1,
  JwtValidationResult,
} from '../interfaces/jwt-payload.interface';
import { JWT_CONSTANTS } from '../constants/jwt.constants';

@Injectable()
export class JwtV1Strategy extends PassportStrategy(Strategy, 'jwt-v1') {
  private readonly logger = new Logger(JwtV1Strategy.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private jwtRevocationService: JwtRevocationService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    const audience = configService.get<string>('JWT_AUDIENCE');
    const issuer = configService.get<string>('JWT_ISSUER');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in configuration');
    }
    if (!audience) {
      throw new Error('JWT_AUDIENCE is not defined in configuration');
    }
    if (!issuer) {
      throw new Error('JWT_ISSUER is not defined in configuration');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      audience: audience,
      issuer: issuer,
    });
  }

  async validate(
    payload: DriverAccessJwtPayloadV1,
  ): Promise<JwtValidationResult> {
    // 1. Validate payload structure
    this.validatePayloadStructure(payload);

    // 2. Check token revocation
    if (await this.jwtRevocationService.isTokenRevoked(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // 3. Check user-level revocation (lost device)
    if (
      await this.jwtRevocationService.isUserRevoked(payload.sub, payload.iat)
    ) {
      throw new UnauthorizedException('User tokens have been revoked');
    }

    // 4. Validate mutable state - User.status
    await this.validateUserStatus(
      payload.sub,
      payload.driverProfileId,
      payload.tenantId,
    );

    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      driverProfileId: payload.driverProfileId,
      role: payload.role,
      jti: payload.jti,
    };
  }

  private validatePayloadStructure(payload: any): void {
    const errors: string[] = [];

    if (!payload.ver || payload.ver !== JWT_CONSTANTS.VERSION) {
      errors.push(
        `Invalid token version: expected ${JWT_CONSTANTS.VERSION}, got ${payload.ver}`,
      );
    }
    if (payload.type !== JWT_CONSTANTS.ACCESS_TYPE) {
      errors.push(
        `Invalid token type: expected ${JWT_CONSTANTS.ACCESS_TYPE}, got ${payload.type}`,
      );
    }
    if (payload.role !== JWT_CONSTANTS.DRIVER_ROLE) {
      errors.push(
        `Invalid role: expected ${JWT_CONSTANTS.DRIVER_ROLE}, got ${payload.role}`,
      );
    }
    if (
      !payload.jti ||
      !payload.tenantId ||
      !payload.driverProfileId ||
      !payload.sub
    ) {
      errors.push('Missing required claims');
    }
    if (errors.length > 0) {
      this.logger.error(`JWT payload validation errors: ${errors.join('; ')}`);
      throw new UnauthorizedException('Invalid token structure');
    }
  }

  private async validateUserStatus(
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
        `Database error during user/driver validation for userId: ${userId}`,
        error.stack,
      );
      throw new UnauthorizedException('Error validating user/driver status');
    }
  }
}
