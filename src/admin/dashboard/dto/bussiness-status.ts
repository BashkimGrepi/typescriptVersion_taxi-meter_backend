import { RidePricingMode, RideStatus } from "@prisma/client";

export interface BussinessStatusResponse {
    range: {
        from: string;
        to: string;
    },
    rides: {
        total: number;
        completed: number;
        cancelled: number;
        failed?: number;    // needs to be added in the schema
        ongoing: number;    // ride status with draft, ongoing
    },
    health?: {
        status: string;     // 200 OK, 500 ERROR
    }
    
}

export interface RevenueOverviewResponse {
    range: {
        from: string;
        to: string;
    },
    currency: string,
    totals: {
        fareSubtotal: number;
        taxAmount: number;
        fareTotal: number;
    },
    averages: {
        avgFareTotal: number;
    }
}

export interface PaymentSummaryResponse {
    range: {
        from: string;
        to: string;
    },
    currency: string,
    counts: {
        paid: number;
        pending: number;
        failed: number;
        refunded: number;
        requiresAction: number;
    },
    amounts: {
        paid: number;
        pending: number;
        failed: number;
        refunded: number;
    },
    breakdown: {
        method: {
            cash: {
                count: number;
                amount: number;
            },
            viva: {
                count: number;
                amount: number;
            }
        },
        
    }
}

export interface LiveOperations {
    ongoingRides: 
        {
            rideId: string;
            driverProfileId: string;
            driverName: string;
            startedAt: string;
            policy: RidePricingMode;
            status: RideStatus;
        }[],
    counts: {
        ongoingRides: number;
        driversOnRide: number;
    }
}

export interface DriverActivity {
    drivers: {
        total: number;
        invited: number;
        active: number;
        inactive: number;
    }
   
}

export interface PerformanceTrendsResponse {
    interval: string;
    currency: string;
    points: {
        timestamp: string;
        ridesCompleted: number;
        fareTotal: number;
    }[],
    busiest: {
        time: string;
        ridesCompleted: number;
    }
}

export interface PaymentSystemHealthResponse {
    provider: string;
    status: 'CONNECTED' | 'WARNING' | 'ERROR' | 'DISCONNECTED'; 
    exertnalAccountIdMasked: string | null;
    connectedAt: string;
    liveMode: boolean;
    error?: string;
    webhooks: {
        lastReceivedAt: string | null;
        failedLast24h: number;
    }
}