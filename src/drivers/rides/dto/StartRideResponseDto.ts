import { PricingPolicy, RideStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";


export class StartRideResponseDtoNew {
    rideId!: string;
    status!: RideStatus;
    startedAt!: Date | null;
    driverProfileId!: string;
    tenantId!: string;
    pricingPolicyId!: string | null;
    pricing!: {
        baseFare: Decimal;
        perKm: Decimal;
        perMin: Decimal;
    };
    

}