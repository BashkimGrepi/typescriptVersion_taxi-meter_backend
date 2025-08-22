import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { DriverLoginDto } from './dto/driver-login.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Validate email/password and return a sanitized user (no passwordHash).
   */
  async validateUser(email: string, pass: string): Promise<{ id: string; email: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) return null;

    const ok = await bcrypt.compare(pass, user.passwordHash);
    if (!ok) return null;

    return { id: user.id, email: user.email };
  }

  /**
   * ADMIN / MANAGER login — returns a tenant-scoped token.
   * If user has multiple memberships and no tenantId is provided,
   * returns a selection list instead of a token.
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
      return {
        requiresTenantSelection: true,
        tenants: memberships.map((m) => ({
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          role: m.role,
        })),
      };
    }

    const mem = memberships.find((m) => m.tenantId === chosenTenantId);
    if (!mem) throw new ForbiddenException('User does not have access to this tenant');

    const payload = {
      sub: user.id,
      email: user.email,
      role: mem.role, // e.g. 'ADMIN'
      tenantId: chosenTenantId,
      tenantName: mem.tenant.name, // optional, handy for UI
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.get('JWT_EXPIRES_IN'),
    };
  }

  /**
   * DRIVER login — returns a tenant-scoped driver token.
   * If the driver has profiles in multiple tenants and no tenant is specified,
   * returns a selection list instead of a token.
   */
  async loginDriver(dto: DriverLoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Active driver profiles for this user
    const profiles = await this.prisma.driverProfile.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        tenant: { select: { name: true } },
      },
    });

    if (profiles.length === 0) {
      throw new UnauthorizedException('Driver profile not found or inactive');
    }

    // Choose tenant/profile
    const requestedTenantId = (dto as any).tenantId as string | undefined; // add tenantId?: string to your DriverLoginDto if you haven't yet
    let profile = profiles[0];

    if (requestedTenantId) {
      const match = profiles.find((p) => p.tenantId === requestedTenantId);
      if (!match) throw new ForbiddenException('Not a driver in the selected tenant');
      profile = match;
    } else if (profiles.length > 1) {
      // Multiple tenants: ask client to choose
      return {
        requiresTenantSelection: true,
        tenants: profiles.map((p) => ({
          tenantId: p.tenantId,
          tenantName: p.tenant.name,
        })),
      };
    }

    const payload = {
      sub: user.id,
      email: user.email,
      type: 'driver',
      driverProfileId: profile.id,
      tenantId: profile.tenantId,
      role: 'DRIVER',
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.get('JWT_EXPIRES_IN'),
      driver: {
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        status: profile.status,
        role: 'DRIVER',
        tenantId: profile.tenantId,
        tenantName: profile.tenant.name,
      },
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
        username: registerDto.username,
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

    // Issue tenant-scoped token
    const payload = {
      sub: user.id,
      email: user.email,
      role: 'ADMIN',
      tenantId: tenant.id,
      tenantName: tenant.name,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.get('JWT_EXPIRES_IN'),
    };
  }
}
