import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto } from './dto/admin/login.dto';
import { RegisterDto } from './dto/admin/register.dto';
import { LoginDto as DriverLoginDto } from './dto/driver/login.dto';
import { ConfigService } from '@nestjs/config';
import { JwtRevocationService } from './services/jwt-revocation.service';
import { DriverAccessJwtPayloadV1 } from './interfaces/jwt-payload.interface';
import { JWT_CONSTANTS } from './constants/jwt.constants';
import { v4 as uuid } from 'uuid';

import { Role } from '@prisma/client';
import { REQUEST } from '@nestjs/core';
import { request } from 'express';
import { TenantScopedService } from 'src/common/services/tenant-scoped.service';

@Injectable()
export class AuthService extends TenantScopedService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(REQUEST) request: Express.Request,
    private readonly jwtRevocationService: JwtRevocationService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    super(request);
  }

  private async generateDriverAccessTokenV1(
    userId: string,
    tenantId: string,
    driverProfileId: string,
  ): Promise<{ access_token: string; expires_in: number; jti: string }> {
    
    try {
      const iat = Math.floor(Date.now() / 1000);
      const ttl = parseInt(this.config.get('JWT_ACCESS_TTL', '28800')); // default 8 hours
      const exp = iat + ttl;
      const jti = uuid();

      this.logger.log(
        `Generating JWT v1 token - userId: ${userId}, tenantId: ${tenantId}, driverProfileId: ${driverProfileId}, ttl: ${ttl}s`,
      );

      const payload: DriverAccessJwtPayloadV1 = {
        sub: userId,
        tenantId,
        driverProfileId,
        role: JWT_CONSTANTS.DRIVER_ROLE,
        type: JWT_CONSTANTS.ACCESS_TYPE,
        aud: this.config.get('JWT_AUDIENCE') || 'api',
        iss: this.config.get('JWT_ISSUER') || 'taxi-meter-api',
        iat,
        exp,
        jti,
        ver: JWT_CONSTANTS.VERSION,
      };

      // Use native jsonwebtoken to avoid NestJS global signOptions conflicts
      const secret = this.config.get('JWT_SECRET');
      if (!secret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const access_token = jwt.sign(payload, secret, {
        algorithm: 'HS256',
        // We don't set expiresIn since we manually set exp in the payload
      });

      this.logger.log(
        `JWT v1 token generated successfully - jti: ${jti}, expires: ${new Date(exp * 1000).toISOString()}`,
      );

      return { access_token, expires_in: ttl, jti };
    } catch (error) {
      this.logger.error(
        `Failed to generate JWT v1 token for userId: ${userId}, tenantId: ${tenantId}, driverProfileId: ${driverProfileId}`,
        error.stack,
      );
      throw error;
    }
  }

  async loginDriverV1(dto: DriverLoginDto) {
    try {
      const user = await this.validateUser(dto.email, dto.password);
      if (!user) throw new UnauthorizedException('Invalid credentials');

      const userWithTenant = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          tenantId: true,
          role: true,
          status: true,
          tenant: { select: { name: true } },
        },
      });

      if (!userWithTenant || userWithTenant.status !== 'ACTIVE') {
        throw new UnauthorizedException('User not found or inactive');
      }

      // find driver profile for the user (should be only one)
      const driverProfile = await this.prisma.driverProfile.findUnique({
        where: { userId: user.id, status: 'ACTIVE' },
        select: {
          id: true,
          tenantId: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          status: true,
          tenant: { select: { name: true } },
        },
      });

      if (!driverProfile || driverProfile.status !== 'ACTIVE') {
        throw new UnauthorizedException('Driver profile not found or inactive');
      }

      // Verify driver profile belongs to user's tenant (data consistency check)
      if (driverProfile.tenantId !== userWithTenant.tenantId) {
        throw new UnauthorizedException('Driver profile tenant mismatch');
      }

      // generate driver access token v1
      const accessToken = await this.generateDriverAccessTokenV1(
        user.id,
        userWithTenant.tenantId,
        driverProfile.id,
      );

      return {
        access_token: accessToken.access_token,
        token_type: 'Bearer',
        expires_in: accessToken.expires_in,
        jti: accessToken.jti,
      }
    } catch (error) {
      this.logger.error(
        `LoginDriverV1 error for email: ${dto.email}`,
        error.stack,
      );
      throw error;
    }
  }

  // Add logout methods
  async revokeDriverToken(jti: string, exp: number): Promise<void> {
    await this.jwtRevocationService.revokeToken(jti, exp);
  }

  async revokeAllDriverTokens(): Promise<void> {
    const userId = this.getCurrentUserId();
    await this.jwtRevocationService.revokeAllUserTokens(userId);
  }

  /**
   * Validate email/password and return a sanitized user (no passwordHash).
   */
  async validateUser(
    email: string,
    pass: string,
  ): Promise<{ id: string; email: string } | null> {
    try {
      this.logger.log(`Validating user credentials for email: ${email}`);

      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, passwordHash: true },
      });

      if (!user) {
        this.logger.warn(`User not found for email: ${email}`);
        return null;
      }

      const ok = await bcrypt.compare(pass, user.passwordHash);
      if (!ok) {
        this.logger.warn(`Invalid password for email: ${email}`);
        return null;
      }

      this.logger.log(
        `User validation successful for email: ${email}, userId: ${user.id}`,
      );
      return { id: user.id, email: user.email };
    } catch (error) {
      this.logger.error(
        `Error validating user for email: ${email}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * ADMIN / MANAGER login — returns a tenant-scoped token.
   * If user has multiple memberships and no tenantId is provided,
   * returns a selection list (with loginTicket) instead of a token.
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const userWithTenant = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        status: true,
        tenant: { select: { name: true } },
      },
    });

    if (!userWithTenant || userWithTenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Issue token with tenant from user record
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        tenantId: userWithTenant.tenantId,
        role: userWithTenant.role, // e.g. 'ADMIN'
        tenantName: userWithTenant.tenant.name, // optional, handy for UI
        type: 'access',
      },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '3600s',
        audience: 'api',
      },
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.get('JWT_EXPIRES_IN'),
      user: {
        id: userWithTenant.id,
        email: userWithTenant.email,
        role: userWithTenant.role,
        tenantId: userWithTenant.tenantId,
        tenantName: userWithTenant.tenant.name,
      },
    };
  }

  /**
   * DRIVER login — returns a tenant-scoped driver token.
   * If the driver has profiles in multiple tenants and no tenant is specified,
   * returns a selection list (with loginTicket) instead of a token.
   */
  async loginDriver(dto: DriverLoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const userWithTenant = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        tenantId: true,
        role: true,
        status: true,
        tenant: { select: { name: true } },
      },
    });

    if (!userWithTenant || userWithTenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Find driver profile for this user (should only be one)
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        status: true,
        tenant: { select: { name: true } },
      },
    });

    if (!driverProfile || driverProfile.status !== 'ACTIVE') {
      throw new UnauthorizedException('Driver profile not found or inactive');
    }

    // Verify driver profile belongs to user's tenant (data consistency check)
    if (driverProfile.tenantId !== userWithTenant.tenantId) {
      throw new UnauthorizedException('Driver profile tenant mismatch');
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        tenantId: userWithTenant.tenantId,
        role: 'DRIVER',
        driverProfileId: driverProfile.id,
        type: 'access',
      },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '3600s',
        audience: 'api',
      },
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.get('JWT_EXPIRES_IN'),
      driver: {
        id: driverProfile.id,
        userId: user.id,
        firstName: driverProfile.firstName,
        lastName: driverProfile.lastName,
        email: user.email,
        phone: driverProfile.phone,
        status: driverProfile.status,
        role: 'DRIVER',
        tenantId: driverProfile.tenantId,
        tenantName: driverProfile.tenant.name,
      },
    };
  }

  /**
   * EXCHANGE (Step 2) — ADMIN/MANAGER:
   * Accepts { loginTicket, tenantId } and returns the final tenant-scoped access token.
   */

  /**
   * EXCHANGE (Step 2) — DRIVER:
   * Accepts { loginTicket, tenantId } and returns the final driver access token.
   */

  /**
   * User self-register — creates a tenant and an ADMIN membership,
   * then returns a tenant-scoped admin token.
   */
  async register(registerDto: RegisterDto) {
    // Check if email already exists (global uniqueness)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException(
        'Email already registered. Each email can only belong to one tenant.',
      );
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    return await this.prisma.$transaction(async (tx) => {
      // Create tenant first
      const tenant = await tx.tenant.create({
        data: {
          name: registerDto.tenant.name,
          businessId: registerDto.tenant.businessId,
        },
        select: { id: true, name: true },
      });

      // Create user with direct tenant relationship
      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          passwordHash,
          tenantId: tenant.id, // Direct assignment
          role: Role.ADMIN, // Direct role assignment
          status: 'ACTIVE',
        },
        select: { id: true, email: true },
      });

      // Issue access token immediately
      const accessToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          tenantId: tenant.id,
          role: Role.ADMIN,
          tenantName: tenant.name,
          type: 'access',
        },
        {
          secret: this.config.get('JWT_SECRET'),
          expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '3600s',
          audience: 'api',
        },
      );

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: this.config.get('JWT_EXPIRES_IN'),
        user: {
          id: user.id,
          email: user.email,
          role: Role.ADMIN,
          tenantId: tenant.id,
          tenantName: tenant.name,
        },
      };
    });
  }
}
