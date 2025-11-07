import { Controller, Post, Body, Req, UseGuards, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/driver/login.dto';
import { Public } from 'src/decorators/public.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DriverV1Guard } from '../guards/driver-v1.guard';

@Controller('auth/driver')
export class DriverAuthController {
  private readonly logger = new Logger(DriverAuthController.name);

  constructor(private authService: AuthService) {}

  // this is the working login for drivers
  @Public()
  @Post('login')
  async loginDriver(@Body() loginDto: LoginDto) {
    return this.authService.loginDriver(loginDto);
  }

  @Public()
  @Post('login-v1')
  async loginDriverV1(@Body() loginDto: LoginDto) {
    try {
      this.logger.log(`Driver login-v1 attempt for email: ${loginDto.email}`);
      const result = await this.authService.loginDriverV1(loginDto);

      return result;
    } catch (error) {
      this.logger.error(
        `Driver login-v1 failed for email: ${loginDto.email}`,
        error.stack,
      );
      throw error;
    }
  }

  
  @Post('logout-v1')
  @UseGuards(DriverV1Guard)
  async logoutDriver(@Req() req: any): Promise<{ message: string }> {
    try {
      const { jti, exp } = req.user;
      await this.authService.revokeDriverToken(jti, exp);
      this.logger.log(`Driver logout successful for userId: ${req.user.sub}, jti: ${jti}`);
      return { message: 'Successfully logged out' };
    } catch (error) {
      this.logger.error(`Driver logout failed for userId: ${req.user.sub}`, error.stack);
      throw error;
    }
  }

  @Post('logout-all-devices')
  @UseGuards(DriverV1Guard)
  async logoutAllDevices(@Req() req: any): Promise<{ message: string }> {
    try {
      await this.authService.revokeAllDriverTokens();
      return { message: 'All devices logged out successfully' };
    } catch (error) {
      this.logger.error(`Driver logout-all-devices failed for user: ${req.user?.sub || 'unknown'}`, error.stack);
      throw error;
    }
  }
}
