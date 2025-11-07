import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Min, IsString, Max, IsIn, IsEmpty, IsNotEmpty, Matches } from "class-validator";



export default class ListPricingPoliciesDto {

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean;

    // case insensitive name search
    @IsOptional()
    @IsString()
    search?: string;

    // Basic pagination (offset + limit) — simple & predictable
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset = 0;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit = 20;

    // Sorting that’s safe to expose
    @IsOptional()
    @IsIn(['createdAt', 'name', 'isActive'])
    orderBy: 'createdAt' | 'name' | 'isActive' = 'createdAt';

    @IsOptional()
    @IsIn(['asc', 'desc'])
    orderDir: 'asc' | 'desc' = 'desc';
}

// We accept money as strings to avoid JS float rounding.
// Regex: 0 or more digits, optional decimal part with up to 2 decimals.
const MONEY_RE = /^(?:\d+)(?:\.\d{1,2})?$/;

export class CreatePricingPolicyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Matches(MONEY_RE, { message: 'baseFare must be a number with up to 2 decimals' })
  baseFare!: string; // "3.90" (EUR)

  @Matches(MONEY_RE, { message: 'perKm must be a number with up to 2 decimals' })
  perKm!: string;    // "1.20" (EUR/km)
  
  @Matches(MONEY_RE, { message: 'perMin must be a number with up to 2 decimals' })
  perMin!: string;   // "0.30" (EUR/min)

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // if true, this one becomes the only active policy
}

// We DO NOT allow changing isActive here.
// Activation is a dedicated endpoint to guarantee the "single active" invariant.
export class UpdatePricingPolicyDto extends PartialType(CreatePricingPolicyDto) {}