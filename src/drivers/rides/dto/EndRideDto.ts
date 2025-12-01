import { DriverProfile, RidePricingMode, RideStatus } from "@prisma/client";
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
  pricingMode!: RidePricingMode;  // Show which mode was used
  
  // For METER mode
  base?: string;                 // "3.00" - only for METER
  distanceComponent?: string;    // perKm * distance - only for METER  
  timeComponent?: string;        // perMin * time - only for METER
  surchargeMultiplier?: string;  // "1.20" - only for METER
  
  // For FIXED_PRICE mode
  fixedAmount?: string;          // "25.00" - only for FIXED_PRICE
  fixedPolicyName?: string;      // "Airport Run" - only for FIXED_PRICE
  
  // For CUSTOM_FIXED mode  
  customAmount?: string;         // "30.00" - only for CUSTOM_FIXED
  
  // Common to all modes
  subtotal!: string;             // before tax
  taxAmount!: string;            // tax portion
  total!: string;                // final amount
  currency!: string;             // "EUR"
}            




export class EndRideResponseDto {
  rideId!: string;
  status!: RideStatus;

  tenantId!: string;
  driverProfileId!: string;
  pricingMode!: RidePricingMode; // Show pricing mode used

  // Mode-specific IDs
  pricingPolicyId?: string; // For METER mode
  fixedPricePolicyId?: string; // For FIXED_PRICE mode

  startedAt!: string;
  endedAt!: string;
  durationMinutes!: number;
  distanceKm!: number;

  // Final amounts (same for all modes)
  fareSubtotal!: string;
  taxAmount!: string;
  fareTotal!: string;

  // Enhanced fare breakdown
  fare?: FareBreakdownDto;

  // Payment fields
  paymentId?: string;
  paymentStatus?: string;
  externalPaymentId?: string;
}