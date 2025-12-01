import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { DriverProfileService } from '../services/driver-profile.service';
import { Driver } from '../../../decorators/driver.decorator';
import type { DriverInfo } from '../../../decorators/driver.decorator';
import { UpdateDriverProfileDto } from '../../dto/update-driver-profile.dto';
import { DriverProfileResponseDto } from '../../dto/driver-profile-response.dto';
import { UniversalV1Guard } from 'src/auth/guards/universal-v1.guard';

@Controller('/driver')
@UseGuards(UniversalV1Guard)
export class DriverProfileController {
  constructor(private driverProfileService: DriverProfileService) {}

  @Get('profile')
  async getProfile(
    @Driver() driver: DriverInfo,
  ): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.getDriverProfile(driver);
  }

  @Put('profile/edit')
  async updateProfile(
    @Driver() driver: DriverInfo,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateData: UpdateDriverProfileDto,
  ): Promise<DriverProfileResponseDto> {
    return this.driverProfileService.updateDriverProfile(driver, updateData);
  }
}
