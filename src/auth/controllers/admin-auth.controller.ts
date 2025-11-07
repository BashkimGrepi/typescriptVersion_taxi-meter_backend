import { Controller, Post, Body, UseGuards, Get, Request, Req } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/admin/login.dto';
import { RegisterDto } from '../dto/admin/register.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
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

 
}
