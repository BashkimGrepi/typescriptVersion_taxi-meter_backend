import { RidePricingMode, RideStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class StartRideResponseDto {
    rideId!: string;
    status!: RideStatus;
    startedAt!: Date | null;
    pricingMode!: RidePricingMode;
    driverProfileId!: string;
    tenantId!: string;
    
    // Pricing information based on mode
    meterPolicy?: MeterPricingInfo;
    pricingPolicyId?: string;
    fixedPricePolicyId?: string;  
    customFixedFare?: string;
    
    // Always null at start for all modes
    durationMin?: Decimal | null;
    distanceKm?: Decimal | null;
    fareSubtotal?: Decimal | null;
    taxAmount?: Decimal | null;
    fareTotal?: Decimal | null;
}

interface MeterPricingInfo {
    id: string;
    name: string;
    baseFare: string;
    perKm: string;
    perMin: string;
    isActive: boolean;
}

interface FixedPricingInfo {
    id: string;
    name: string;
    amount: string;  // Fixed total amount
    isActive: boolean;
    driverProfileId?: string; // null for tenant-wide, populated for personal tariffs
}
