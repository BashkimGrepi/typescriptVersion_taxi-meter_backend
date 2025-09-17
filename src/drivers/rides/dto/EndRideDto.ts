import { DriverProfile, RideStatus } from "@prisma/client";
import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from "class-validator";


export class EndRideDto {
    @IsUUID('4')
    rideId!: string;

    @IsNumber()
    @Min(0)
    distanceKm!: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    durationMin?: number;

    @IsOptional()
    @IsDateString()
    endedAt?: string;
} 

export class FareBreakdownDto {
  base!: string;                // "3.00"
  //timeComponent!: string;       // perMinute * duration
  distanceComponent!: string;   // perKm * distance
  surchargeMultiplier!: string; // "1.20"
  subtotal!: string;            // before tax
  taxAmount!: string;
  total!: string;
  currency!: string;            // "EUR"
}



export class EndRideResponseDto {
  rideId!: string;
  status!: RideStatus;          // will be RideStatus.COMPLETED

  tenantId!: string;
  driverProfileId!: string;
  pricingPolicyId!: string;

  startedAt!: string;           // ISO
  endedAt!: string;             // ISO
  durationMinutes!: number;
  distanceKm!: number;

  // flat fields you’ll aggregate in reports
  fareSubtotal!: string;        // before tax
  taxAmount!: string;
  fareTotal!: string;

  // optional detailed receipt for UI
  fare?: FareBreakdownDto;


  // payment fields for viva terminals use
  paymentId?: string;
  paymentStatus?: string;
  externalPaymentId?: string;
}