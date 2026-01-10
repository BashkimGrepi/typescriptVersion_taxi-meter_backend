import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class SummaryQueryDto{
    @IsDateString() from!: string; //ISO
    @IsDateString() to!: string; //ISO
    
  
}

export class SummaryDto {
    tenantId!: string;
    from!: string;
    to!: string;
    rides!: { completed: number; cancelled: number; activeDrivers: number };
    revenue!: { subtotal: string; tax: string; total: string; currency: 'EUR' };
}