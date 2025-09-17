import { Module } from '@nestjs/common';
import { DriverProfileController } from './profile/controllers/driver-profile.controller';
import { DriverProfileService } from './profile/services/driver-profile.service';
import { DriverGuard } from '../auth/guards/driver.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { DriverRideController } from './rides/controllers/driver-ride.controller';
import { DriverRideService } from './rides/services/driver-ride.service';

@Module({
  imports: [PrismaModule],
  controllers: [DriverProfileController, DriverRideController,],
  providers: [DriverProfileService, DriverRideService , DriverGuard],
  exports: [DriverProfileService] // Export for use in other modules
})
export class DriversModule {}
