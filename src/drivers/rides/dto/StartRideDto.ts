import { RidePricingMode, RideStatus } from '@prisma/client';
import { IsDecimal, IsEnum, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class StartRideDto {
  @IsEnum(RideStatus)
  rideStatus: RideStatus;

  @IsUUID('4') // version 4 UUID
  driverProfileId: string;

  @IsEnum(RidePricingMode)
  pricingMode: RidePricingMode = RidePricingMode.METER; // default

  @ValidateIf((o) => o.pricingMode === RidePricingMode.FIXED_PRICE)
  @IsUUID('4', {
    message:
      'Pricing policy ID must be a valid UUID when using FIXED_PRICE mode',
  })
  fixedPricingPolicyId?: string; // required if pricingMode is FIXED

  @ValidateIf((o) => o.pricingMode === RidePricingMode.CUSTOM_FIXED)
  @IsDecimal(
    { decimal_digits: '0,2' },
    {
      message:
        'Custom fixed fare must be a valid decimal with up to 2 decimal places',
    },
  )
  @Min(5, { message: 'Custom fixed fare must be at least €5.00' })
  @Max(999.99, { message: 'Custom fixed fare cannot exceed €999.99' })
  customFixedFare?: string; // required if pricingMode is CUSTOM_FIXED
}
