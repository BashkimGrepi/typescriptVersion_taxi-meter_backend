import { Module } from '@nestjs/common';
import { DriverProfileController } from './profile/controllers/driver-profile.controller';
import { DriverProfileService } from './profile/services/driver-profile.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DriverRideController } from './rides/controllers/driver-ride.controller';
import { DriverRideService } from './rides/services/driver-ride.service';
import { DriverV1Guard } from 'src/auth/guards/driver-v1.guard';

@Module({
  imports: [PrismaModule],
  controllers: [DriverProfileController, DriverRideController,],
  providers: [DriverProfileService, DriverRideService , DriverV1Guard],
  exports: [DriverProfileService] // Export for use in other modules
})
export class DriversModule {}
