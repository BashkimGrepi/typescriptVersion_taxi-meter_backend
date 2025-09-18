import { RideStatus } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class StartRideDto {
  @IsEnum(RideStatus)
  rideStatus: RideStatus;

  @IsUUID('4') // version 4 UUID  
  driverProfileId: string;
}
