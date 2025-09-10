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
        signOptions: { 
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h') // Token expiration time 
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminAuthController, DriverAuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
})
export class AuthModule {}
