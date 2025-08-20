import { RideStatus } from "@prisma/client";

export class StartRideDto {
    rideStatus: RideStatus;
    driverProfileId: string;
}