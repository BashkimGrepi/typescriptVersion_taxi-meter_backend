import { IsEmail, IsString, IsOptional, IsIn, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInvitationDto {
  @ApiProperty({
    description: 'Email address of the person to invite',
    example: 'driver@example.com'
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  email: string;

  @ApiProperty({
    description: 'Role for the invited user',
    example: 'DRIVER',
    enum: ['DRIVER', 'MANAGER']
  })
  @IsIn(['DRIVER', 'MANAGER'], {
    message: 'Role must be either DRIVER or MANAGER'
  })
  role: 'DRIVER' | 'MANAGER';

  @ApiProperty({
    description: 'First name for driver profile (required for DRIVER role)',
    example: 'John',
    required: false
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'Last name for driver profile (required for DRIVER role)',
    example: 'Doe',
    required: false
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'Phone number for driver profile (optional)',
    example: '+358401234567',
    required: false
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Link invitation to specific driver profile',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    required: false
  })
  @IsOptional()
  @IsUUID(4, { message: 'Driver profile ID must be a valid UUID' })
  driverProfileId?: string;
}

export class InvitationsQueryDto {
  @ApiProperty({
    description: 'Filter by invitation status',
    example: 'pending',
    enum: ['pending', 'accepted', 'expired'],
    required: false
  })
  @IsOptional()
  @IsIn(['pending', 'accepted', 'expired'], {
    message: 'Status must be one of: pending, accepted, expired'
  })
  status?: string;

  @ApiProperty({
    description: 'Filter by role',
    example: 'DRIVER',
    enum: ['DRIVER', 'MANAGER'],
    required: false
  })
  @IsOptional()
  @IsIn(['DRIVER', 'MANAGER'], {
    message: 'Role must be either DRIVER or MANAGER'
  })
  role?: string;

  @ApiProperty({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 25,
    default: 25,
    minimum: 1,
    maximum: 100,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'Page size must be at least 1' })
  @Max(100, { message: 'Page size cannot exceed 100' })
  pageSize?: number = 25;
}

export class InvitationResponseDto {
  @ApiProperty({ description: 'Invitation ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ description: 'Tenant ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  tenantId: string;

  @ApiProperty({ description: 'Invited email', example: 'driver@example.com' })
  email: string;

  @ApiProperty({ description: 'Assigned role', example: 'DRIVER' })
  role: string;

  @ApiProperty({ description: 'Invitation token', example: 'abcd1234-...' })
  token: string;

  @ApiProperty({ description: 'Invitation status', example: 'pending' })
  status: string;

  @ApiProperty({ description: 'Expiration timestamp', example: '2024-02-15T14:30:00.000Z' })
  expiresAt: string;

  @ApiProperty({ description: 'Acceptance timestamp', example: '2024-01-20T14:30:00.000Z', required: false })
  acceptedAt?: string;

  @ApiProperty({ description: 'Name of user who sent invitation', example: 'Admin User', required: false })
  invitedByName?: string;

  @ApiProperty({ description: 'Associated driver profile name', example: 'John Doe', required: false })
  driverProfileName?: string;

  @ApiProperty({ description: 'Driver profile ID if role is DRIVER', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', required: false })
  driverProfileId?: string;
}

export class InvitationsPageResponse {
  @ApiProperty({
    description: 'List of invitations',
    type: [InvitationResponseDto]
  })
  items: InvitationResponseDto[];

  @ApiProperty({ description: 'Total number of invitations', example: 50 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 25 })
  pageSize: number;

  @ApiProperty({ description: 'Total pages', example: 2 })
  totalPages: number;
}
