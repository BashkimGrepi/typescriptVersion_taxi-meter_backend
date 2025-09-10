import { Controller, Post, Body, Req } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/driver/login.dto';
import { Public } from 'src/decorators/public.decorator';
import { SelectTenantDto } from '../dto/driver/select-tenant.dto';

@Controller('auth/driver')
export class DriverAuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async loginDriver(@Body() loginDto: LoginDto) {
    return this.authService.loginDriver(loginDto);
  }
    
  @Public()
  @Post('select-tenant')
  async selectTenantDriver(
    @Body() dto: { loginTicket?: string; tenantId: string },
    @Req() req: Request
  ) {
    const fromHeader = req.headers['authorization']?.startsWith('Bearer ')
        ? req.headers['authorization'].slice(7)
        : undefined;

    return this.authService.selectTenantDriver({
        loginTicket: dto.loginTicket ?? fromHeader,
        tenantId: dto.tenantId,
    });
  }
}
