import { PaymentStatus, RideStatus } from "@prisma/client";
import { FareBreakdownDto } from "./EndRideDto";

export interface RideDetailsDto {
    id: string;
    status: RideStatus;
    timing: {
        startedAt: string;   // ISO string
        endedAt?: string;    // ISO string or null
        duration: string;
    };
    distance: {
        totalKm: string;
        displayKm: string;
    };
    fare: {
        subtotal: string;
        tax: string;
        total: string;
        currency: string;
        breakdown: FareBreakdownDto;
    };
    payment?: {
        id: string;
        status: PaymentStatus;
        method?: string;
        externalId?: string;
    };
}