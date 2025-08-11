import { Module } from '@nestjs/common';
import { DriverProfileController } from './driver-profile.controller';
import { DriverProfileService } from './driver-profile.service';
import { DriverGuard } from '../auth/guards/driver.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DriverProfileController],
  providers: [DriverProfileService, DriverGuard],
  exports: [DriverProfileService] // Export for use in other modules
})
export class DriversModule {}
