import { Controller, Post, Body, UseGuards, Get, Request, Req } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/admin/login.dto';
import { RegisterDto } from '../dto/admin/register.dto';
import { Public } from 'src/decorators/public.decorator';
import { UserResponseDto } from '../dto/common/user-response.dto';

@Controller('auth/admin')
export class AdminAuthController {
  constructor(private authService: AuthService) {}
  
  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('me')
  getProfile(@Request() req) {
    return new UserResponseDto(req.user);
  }

  @Public()
  @Post('select-tenant')
  async selectTenant(@Body() dto: { loginTicket?: string; tenantId: string }, @Req() req) {
    const fromHeader = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;

    return this.authService.selectTenant({
      loginTicket: dto.loginTicket ?? fromHeader,
      tenantId: dto.tenantId,
    });
  }


  // logout endpoint to revoke tokens
}
