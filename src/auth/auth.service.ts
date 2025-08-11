import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
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
    private prisma: PrismaService, // Fixed parameter name
    private jwtService: JwtService,
    private config: ConfigService
  ) {}

  async validateUser(email: string, pass: string) {
    // First get the user
    const user = await (this.prisma as any).user.findUnique({
      where: { email }
    });
    
    if (!user) return null;
    
    const passwordValid = await bcrypt.compare(pass, user.passwordHash);
    if (!passwordValid) return null;
    
    // Get memberships separately
    const memberships = await (this.prisma as any).membership.findMany({
      where: { userId: user.id },
      include: {
        tenant: true
      }
    });
    
    return {
      ...user,
      memberships
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    return this.generateToken(user);
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email }
    });
    
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }
    
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    
    const user = await (this.prisma as any).user.create({
      data: {
        email: registerDto.email,
        passwordHash: hashedPassword,
        username: registerDto.username,
        status: 'ACTIVE'
      }
    });

    // Create tenant first
    const tenant = await (this.prisma as any).tenant.create({
      data: {
        name: registerDto.tenant.name,
        businessId: registerDto.tenant.businessId
      }
    });

    // Create membership
    await (this.prisma as any).membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: 'ADMIN'
      }
    });

    // Create a user object with memberships for token generation
    const userWithMemberships = {
      ...user,
      memberships: [{
        role: 'ADMIN',
        tenantId: tenant.id,
        tenant: tenant
      }]
    };
    
    return this.generateToken(userWithMemberships);
  }

  async loginDriver(driverLoginDto: DriverLoginDto) {
    // First validate user credentials
    const user = await this.validateUser(driverLoginDto.email, driverLoginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has DRIVER role in any tenant
    const driverMembership = user.memberships?.find(m => m.role === 'DRIVER');
    if (!driverMembership) {
      throw new UnauthorizedException('User is not authorized as a driver');
    }

    // Get the driver profile
    const driverProfile = await (this.prisma as any).driverProfile.findFirst({
      where: { 
        userId: user.id,
        tenantId: driverMembership.tenantId 
      },
      include: {
        tenant: true
      }
    });

    if (!driverProfile) {
      throw new UnauthorizedException('Driver profile not found');
    }

    // Check if driver profile is active
    if (driverProfile.status !== 'ACTIVE') {
      throw new UnauthorizedException(`Driver account is ${driverProfile.status.toLowerCase()}. Please contact your administrator.`);
    }

    // Generate JWT with driver-specific claims
    const payload = {
      sub: user.id,
      email: user.email,
      type: 'driver',
      driverProfileId: driverProfile.id,
      tenantId: driverProfile.tenantId,
      role: 'DRIVER'
    };

    return {
      access_token: this.jwtService.sign(payload),
      expires_in: this.config.get('JWT_EXPIRES_IN'),
      driver: {
        id: driverProfile.id,
        firstName: driverProfile.firstName,
        lastName: driverProfile.lastName,
        phone: driverProfile.phone,
        status: driverProfile.status,
        role: 'DRIVER',
        tenantId: driverProfile.tenantId,
        tenantName: driverProfile.tenant.name
      }
    };
  }

  private generateToken(user: any) {
    const payload = { 
      sub: user.id,
      email: user.email,
      roles: user.memberships ? user.memberships.map(m => ({
        role: m.role,
        tenantId: m.tenantId
      })) : []
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      expires_in: this.config.get('JWT_EXPIRES_IN')
    };
  }
}