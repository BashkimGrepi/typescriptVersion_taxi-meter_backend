import { Controller, Post, Body, UseGuards, Get, Request, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from 'src/decorators/public.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { SelectTenantDto } from './dto/select-tenant.dto';
import { SelectTenantDriverDto } from './dto/select-tenant-driver.dto';

@Controller('auth')
export class AuthController {
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
      loginTicket: dto.loginTicket ?? fromHeader,  // <-- accept body OR header
      tenantId: dto.tenantId,
    });
}


  


}