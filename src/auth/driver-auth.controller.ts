import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DriverLoginDto } from './dto/driver-login.dto';
import { Public } from 'src/decorators/public.decorator';

@Controller('api/driver')
export class DriverAuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async loginDriver(@Body() driverLoginDto: DriverLoginDto) {
    return this.authService.loginDriver(driverLoginDto);
  }
}
