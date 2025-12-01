import { Controller, Post, Body, Req, UseGuards, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/driver/login.dto';
import { SelectTenantDto } from '../dto/driver/select-tenant.dto';
import { Public } from 'src/decorators/public.decorator';
import { UniversalV1Guard } from '../guards/universal-v1.guard';

@Controller('auth/driver')
export class DriverAuthController {
  private readonly logger = new Logger(DriverAuthController.name);

  constructor(private authService: AuthService) {}

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



  @Public()
  @Post('select-tenant-v1')
  async selectTenantDriverV1(
    @Body() dto: SelectTenantDto,
    @Req() req: Request,
  ) {
    try {
      const fromHeader = req.headers['authorization']?.startsWith('Bearer ')
        ? req.headers['authorization'].slice(7)
        : undefined;

      const loginTicket = dto.loginTicket ?? fromHeader;
      this.logger.log(
        `Driver select-tenant-v1 attempt for tenantId: ${dto.tenantId}`,
      );

      const result = await this.authService.selectTenantDriverV1({
        loginTicket,
        tenantId: dto.tenantId,
      });

      this.logger.log(
        `Driver select-tenant-v1 successful for tenantId: ${dto.tenantId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Driver select-tenant-v1 failed for tenantId: ${dto.tenantId}`,
        error.stack,
      );
      throw error;
    }
  }

  
  
  @Post('logout-v1')
  @UseGuards(UniversalV1Guard)
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
  @UseGuards(UniversalV1Guard)
  async logoutAllDevices(@Req() req: any): Promise<{ message: string }> {
    try {
      await this.authService.revokeAllDriverTokens(req.user.sub);
      this.logger.log(`Driver logout-all-devices successful for user: ${req.user.sub}`);
      return { message: 'All devices logged out successfully' };
    } catch (error) {
      this.logger.error(`Driver logout-all-devices failed for user: ${req.user?.sub || 'unknown'}`, error.stack);
      throw error;
    }
  }
}
