import { PaymentStatus, RidePricingMode, RideStatus } from "@prisma/client";
import { FareBreakdownDto } from "./EndRideDto";

export interface RideDetailsDto {
    id: string;
    status: RideStatus;
    pricingMode: RidePricingMode;
    timing: Timing;
    distance: Distance;
    fare: Fare;
    pricingInfo?: PricingInfo;
    payment?: Payment;
}

interface Timing {
    startedAt: string;   // ISO string
    endedAt?: string;    // ISO string or null
    duration: string;
}

interface Distance {
    totalKm: string;
    displayKm: string;
}

interface Fare {
    subtotal: string;
    tax: string;
    total: string;
    currency: string;
    breakdown: FareBreakdownDto;
}

interface PricingInfo {
    meterPolicy?: {
        name: string;
        baseFare: string;
        perKm: string;
        perMin: string;
    };
    fixedPricePolicy?: {
        name: string;
        amount: string;
        isPersonal?: boolean;
    };
    customFare?: {
        amount: string;
        note: string; // "Driver set custom fare"
    };
};

interface Payment {
    id: string;
    status: PaymentStatus;
    method?: string;
    externalId?: string;
}