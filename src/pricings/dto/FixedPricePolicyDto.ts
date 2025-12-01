import { Decimal } from '@prisma/client/runtime/library';
import {
  IsString,
  IsNotEmpty,
  IsDecimal,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateFixedPricePolicyDto {
  @IsString()
  @IsNotEmpty()
  name!: string; // "Airport Flat Rate"

  @IsDecimal({ decimal_digits: '0,2' })
  amount!: string; // "25.50"


}

export class UpdateFixedPricePolicyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  amount?: string;

}

export class FixedPricePolicyResponseDto {
  id!: string;
  tenantId!: string;
  tenantName: string;
  name!: string;
  amount!: String;
  createdAt!: string;
  createdByUserId?: string; // for admin view
}

export interface ListFixedPricingPoliciesDto {
  id: string;
  tenantId: string;
  tenantName: string;
  name: string;
  amount: String;

}
