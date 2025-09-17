import { PricingPolicy, RideStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class StartRideResponseDto {
    rideId!: string;
    status!: RideStatus;
    startedAt!: Date | null;
    pricingPolicyId!: string | null;
    driverProfileId!: string;
    tenantId!: string;
    durationMin!: Decimal | null;
    distanceKm!: Decimal | null;
    fareSubtotal!: Decimal | null;
    taxAmount!: Decimal | null;
    fareTotal!: Decimal | null;

}