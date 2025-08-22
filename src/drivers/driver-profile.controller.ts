import { 
  Controller, 
  Get, 
  Put, 
  Body, 
  UseGuards,
  ValidationPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DriverGuard } from '../auth/guards/driver.guard';
import { DriverProfileService } from './driver-profile.service';
import { Driver } from '../decorators/driver.decorator';
import type { DriverInfo } from '../decorators/driver.decorator';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { DriverProfileResponseDto } from './dto/driver-profile-response.dto';

@Controller('/driver')
@UseGuards(JwtAuthGuard, DriverGuard)
export class DriverProfileController {
  constructor(private driverProfileService: DriverProfileService) {}

  @Get('profile')
  async getProfile(@Driver() driver: DriverInfo): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.getDriverProfile(driver);
  }

  @Put('profile/edit')
  async updateProfile(
    @Driver() driver: DriverInfo,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) 
    updateData: UpdateDriverProfileDto
  ): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.updateDriverProfile(driver, updateData);
  }
}
