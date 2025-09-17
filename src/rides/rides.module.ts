import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DriverRideController } from '../drivers/rides/controllers/driver-ride.controller';
import { DriverRideService } from '../drivers/rides/services/driver-ride.service';

@Module({
    imports: [PrismaModule],
    controllers: [DriverRideController],
    providers: [DriverRideService],
    exports: [DriverRideService],
})
export class RidesModule {}