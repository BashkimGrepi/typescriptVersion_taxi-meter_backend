import { IsOptional, IsString, IsEmail } from 'class-validator';

export class UpdateAdminProfileDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
