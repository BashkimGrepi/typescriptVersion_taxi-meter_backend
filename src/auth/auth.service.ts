import {
  ConflictException,
  ForbiddenException,
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
import { UnifiedJwtPayload } from './interfaces/jwt-payload.interface';
import { JWT_CONSTANTS } from './constants/jwt.constants';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtRevocationService: JwtRevocationService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async generateUnifiedAccessToken(
    userId: string,
    email: string,
    role: 'ADMIN' | 'MANAGER' | 'DRIVER',
    tenantId: string,
    tenantName: string,
    driverProfileId?: string,
  ): Promise<{ access_token: string; expires_in: number; jti: string }> {
    try {
      const iat = Math.floor(Date.now() / 1000);
      const ttl = parseInt(this.config.get('JWT_ACCESS_TTL', '28800')); // default 8 hours
      const exp = iat + ttl;
      const jti = uuid();

      this.logger.log(
        `Generating unified JWT token - userId: ${userId}, role: ${role}, tenantId: ${tenantId}${driverProfileId ? `, driverProfileId: ${driverProfileId}` : ''}, ttl: ${ttl}s`,
      );

      const payload: UnifiedJwtPayload = {
        sub: userId,
        email: email,
        tenantId: tenantId,
        tenantName: tenantName,
        role: role,
        type: 'access',
        aud: this.config.get('JWT_AUDIENCE') || 'api',
        iss: this.config.get('JWT_ISSUER') || 'taxi-meter-api',
        iat,
        exp,
        jti,
        ver: 1,
        ...(driverProfileId && { driverProfileId }),
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
        `Unified JWT token generated successfully - jti: ${jti}, role: ${role}, expires: ${new Date(exp * 1000).toISOString()}`,
      );

      return { access_token, expires_in: ttl, jti };
    } catch (error) {
      this.logger.error(
        `Failed to generate unified JWT token for userId: ${userId}, role: ${role}, tenantId: ${tenantId}`,
        error.stack,
      );
      throw error;
    }
  }

  async loginDriverV1(dto: DriverLoginDto) {
    try {
      this.logger.log(`LoginDriverV1 attempt for email: ${dto.email}`);

      const user = await this.validateUser(dto.email, dto.password);
      if (!user) {
        this.logger.warn(
          `LoginDriverV1 failed - invalid credentials for email: ${dto.email}`,
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      this.logger.log(
        `User validated successfully for email: ${dto.email}, userId: ${user.id}`,
      );

      // Active driver profiles for this user
      const profiles = await this.prisma.driverProfile.findMany({
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

      this.logger.log(
        `Found ${profiles.length} active driver profiles for user: ${user.id}`,
      );

      if (profiles.length === 0) {
        this.logger.warn(
          `LoginDriverV1 failed - no active driver profiles for user: ${user.id}`,
        );
        throw new UnauthorizedException('Driver profile not found or inactive');
      }

      // Choose tenant/profile
      const requestedTenantId = dto.tenantId;
      let profile = profiles[0];

      if (requestedTenantId) {
        this.logger.log(`Specific tenant requested: ${requestedTenantId}`);
        const match = profiles.find((p) => p.tenantId === requestedTenantId);
        if (!match) {
          this.logger.warn(
            `LoginDriverV1 failed - user ${user.id} not a driver in tenant: ${requestedTenantId}`,
          );
          throw new ForbiddenException('Not a driver in the selected tenant');
        }
        profile = match;
      } else if (profiles.length > 1) {
        // Multiple tenants: ask client to choose
        this.logger.log(
          `Multiple tenants found for user ${user.id}, generating tenant selection response`,
        );

        // Include loginTicket for JWT v1
        const loginTicket = await this.jwtService.signAsync(
          { sub: user.id, purpose: 'tenant_selection' },
          {
            secret: this.config.get('JWT_TICKET_SECRET'),
            expiresIn: this.config.get('JWT_TICKET_EXPIRES') ?? '300s',
            audience: 'tenant-selection',
          },
        );

        const result = {
          requiresTenantSelection: true,
          tenants: profiles.map((p) => ({
            tenantId: p.tenantId,
            tenantName: p.tenant.name,
          })),
          loginTicket,
        };

        this.logger.log(
          `Generated tenant selection response with ${result.tenants.length} tenants for user: ${user.id}`,
        );
        return result;
      }

      this.logger.log(
        `Selected profile: ${profile.id} for tenant: ${profile.tenantId}`,
      );

      // Generate JWT v1 access token
      const { access_token, expires_in } =
        await this.generateUnifiedAccessToken(
          user.id,
          user.email,
          'DRIVER',
          profile.tenantId,
          profile.tenant.name,
          profile.id,
        );
      this.logger.log(
        `Generated JWT v1 token for user: ${user.id}, profile: ${profile.id}, tenant: ${profile.tenantId}`,
      );

      return {
        access_token,
        token_type: JWT_CONSTANTS.TOKEN_TYPE,
        expires_in,
      };
    } catch (error) {
      this.logger.error(
        `LoginDriverV1 error for email: ${dto.email}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * EXCHANGE (Step 2) — DRIVER V1:
   * Accepts { loginTicket, tenantId } and returns the final JWT v1 driver access token.
   */
  async selectTenantDriverV1(dto: { loginTicket: string; tenantId: string }) {
    try {
      this.logger.log(
        `SelectTenantDriverV1 attempt for tenantId: ${dto.tenantId}`,
      );

      // Verify ticket with TICKET secret + audience
      const decoded = await this.jwtService.verifyAsync(dto.loginTicket, {
        secret: this.config.get('JWT_TICKET_SECRET'),
        audience: 'tenant-selection',
      });

      if (decoded?.purpose !== 'tenant_selection') {
        this.logger.warn(
          `SelectTenantDriverV1 failed - invalid ticket purpose: ${decoded?.purpose}`,
        );
        throw new UnauthorizedException('Invalid ticket purpose');
      }

      this.logger.log(
        `Ticket verified for user: ${decoded.sub}, selecting tenant: ${dto.tenantId}`,
      );

      // Fresh driver profile check
      const profile = await this.prisma.driverProfile.findFirst({
        where: {
          userId: decoded.sub,
          tenantId: dto.tenantId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          tenantId: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          status: true,
          tenant: { select: { name: true } },
          user: { select: { id: true, email: true } },
        },
      });

      if (!profile) {
        this.logger.warn(
          `SelectTenantDriverV1 failed - user ${decoded.sub} not a driver in tenant: ${dto.tenantId}`,
        );
        throw new ForbiddenException('Not a driver in the selected tenant');
      }

      this.logger.log(
        `Profile found: ${profile.id} for user: ${decoded.sub} in tenant: ${dto.tenantId}`,
      );

      const { access_token: accessToken, expires_in } =
        await this.generateUnifiedAccessToken(
          profile.user!.id,
          profile.user!.email,
          'DRIVER',
          profile.tenantId,
          profile.tenant.name,
          profile.id,
        );

      return {
        access_token: accessToken,
        token_type: JWT_CONSTANTS.TOKEN_TYPE,
        expires_in,
      };
    } catch (error) {
      this.logger.error(
        `SelectTenantDriverV1 error for tenantId: ${dto.tenantId}`,
        error.stack,
      );
      throw error;
    }
  }

  // Add logout methods
  async revokeDriverToken(jti: string, exp: number): Promise<void> {
    await this.jwtRevocationService.revokeToken(jti, exp);
  }

  async revokeAllDriverTokens(userId: string): Promise<void> {
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

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        tenantId: true,
        tenant: { select: { name: true } },
      },
    });

    if (memberships.length === 0) {
      throw new ForbiddenException('No tenant memberships');
    }

    // Choose tenant for this session
    let chosenTenantId = (loginDto as any).tenantId as string | undefined; // support optional tenantId in DTO
    if (!chosenTenantId && memberships.length === 1) {
      chosenTenantId = memberships[0].tenantId;
    }

    if (!chosenTenantId) {
      // Ask client to choose a tenant; do NOT mint a token yet
      // NEW: also return a short-lived loginTicket
      const loginTicket = await this.jwtService.signAsync(
        { sub: user.id, purpose: 'tenant_selection' },
        {
          secret: this.config.get('JWT_TICKET_SECRET'),
          expiresIn: this.config.get('JWT_TICKET_EXPIRES') ?? '300s',
          audience: 'tenant-selection',
        },
      );

      return {
        requiresTenantSelection: true,
        tenants: memberships.map((m) => ({
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          role: m.role,
        })),
        loginTicket,
      };
    }

    const mem = memberships.find((m) => m.tenantId === chosenTenantId);
    if (!mem)
      throw new ForbiddenException('User does not have access to this tenant');

    // CHANGED: final access token has type:'access' and uses consistent JWT_SECRET
    const { access_token: accessToken, expires_in } =
      await this.generateUnifiedAccessToken(
        user.id,
        user.email,
        mem.role as 'ADMIN' | 'MANAGER',
        chosenTenantId,
        mem.tenant.name,
      );

    return {
      access_token: accessToken,
      token_type: JWT_CONSTANTS.TOKEN_TYPE,
      expires_in,
    };
  }

  /**
   * EXCHANGE (Step 2) — ADMIN/MANAGER:
   * Accepts { loginTicket, tenantId } and returns the final tenant-scoped access token.
   */
  async selectTenant(dto: { loginTicket: string; tenantId: string }) {
    // Verify ticket with TICKET secret + audience
    const decoded = await this.jwtService.verifyAsync(dto.loginTicket, {
      secret: this.config.get('JWT_TICKET_SECRET'),
      audience: 'tenant-selection',
    });
    if (decoded?.purpose !== 'tenant_selection') {
      throw new UnauthorizedException('Invalid ticket purpose');
    }

    // Fresh membership check
    const membership = await this.prisma.membership.findFirst({
      where: { userId: decoded.sub, tenantId: dto.tenantId },
      select: {
        role: true,
        tenantId: true,
        tenant: { select: { name: true } },
        user: { select: { id: true, email: true } },
      },
    });
    if (!membership)
      throw new ForbiddenException('Not a member of this tenant');

    const { access_token: accessToken, expires_in } =
      await this.generateUnifiedAccessToken(
        membership.user.id,
        membership.user.email,
        membership.role as 'ADMIN' | 'MANAGER',
        membership.tenantId,
        membership.tenant.name,
      );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.get('JWT_EXPIRES_IN'),
      user: { id: membership.user.id, email: membership.user.email },
      tenant: { id: membership.tenantId, name: membership.tenant.name },
      role: membership.role,
    };
  }

  /**
   * User self-register — creates a tenant and an ADMIN membership,
   * then returns a tenant-scoped admin token.
   */
  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
      select: { id: true },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        passwordHash,
        status: 'ACTIVE',
      },
      select: { id: true, email: true },
    });

    const tenant = await this.prisma.tenant.create({
      data: {
        name: registerDto.tenant.name,
        businessId: registerDto.tenant.businessId,
      },
      select: { id: true, name: true },
    });

    await this.prisma.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
    });

    // Issue tenant-scoped token (consistent JWT_SECRET)
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: 'ADMIN',
        tenantId: tenant.id,
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
    };
  }
}
