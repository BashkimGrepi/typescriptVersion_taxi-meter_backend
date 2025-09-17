import { RideStatus } from "@prisma/client";

export interface RideHistoryResponseDto {
    rides: RideHistoryItemDto[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalRides: number;
        hasNext: boolean;
    };
    summary: {
        totalEarnings: string;
        totalDistance: string;
        periodLabel: string; // e.g., "Last 7 days, this month, etc."
    };
}

export interface RideHistoryItemDto {
    id: string;
    startedAt: string; // ISO string
    endedAt: string;
    duration: string;
    distance: string;
    earnings: string;
    status: RideStatus;
}

export interface RideHistoryRequestDto {
    timeFilter: 'week' | 'month' | 'all';
    page?: number;
    limit?: number;
}