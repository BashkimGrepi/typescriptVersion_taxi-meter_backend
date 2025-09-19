import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { DriverAuthController } from './controllers/driver-auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtV1Strategy } from './strategies/jwt-v1-strategy';
import { JwtRevocationService } from './services/jwt-revocation.service';
import { DriverV1Guard } from './guards/driver-v1.guard';

// JWT Configuration

@Module({
    imports: [
    PassportModule,
    PrismaModule,
        //Sets up JWT module with environment-based configuration
        //Injects JwtService throughout the application
        //Configures token signin and expiration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // Secret key for signing/verifying tokens
        signOptions: { expiresIn: "1h" },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminAuthController, DriverAuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    JwtV1Strategy,
    JwtRevocationService,
    DriverV1Guard,
  ],
  exports: [AuthService, JwtRevocationService, DriverV1Guard], // Export services for use in other modules
})
export class AuthModule {}
