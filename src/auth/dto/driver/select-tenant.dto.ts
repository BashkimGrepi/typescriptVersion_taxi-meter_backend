import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SelectTenantDto {
  @IsNotEmpty()
  @IsString()
  tenantId!: string;

  @IsOptional()
  @IsString()
  loginTicket?: string;
}
