import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RideController } from './ride.controller';
import { RideService } from './ride.service';

@Module({
    imports: [PrismaModule],
    controllers: [RideController],
    providers: [RideService],
    exports: [RideService],
})
export class RidesModule {}