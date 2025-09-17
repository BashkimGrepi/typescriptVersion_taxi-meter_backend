export interface TodaysSummaryDto {
    date: string;                    // "2025-09-14"
    totalRides: number;              // 8
    totalEarnings: string;           // "125.50"
    currency: string;                // "EUR"
    hoursWorked?: number;            // 6.5
    averageRideValue?: string;       // "15.69"
    activeRideId?: string | null;           // null or current ride ID
}