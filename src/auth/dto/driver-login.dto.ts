import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DriverLoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
