import { IsEmail, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TenantDto {
  @IsNotEmpty()
  name: string;
  
  @IsNotEmpty()
  businessId: string;
}
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsString()
  username?: string;

  @ValidateNested()
  @Type(() => TenantDto)
  tenant: TenantDto;
}