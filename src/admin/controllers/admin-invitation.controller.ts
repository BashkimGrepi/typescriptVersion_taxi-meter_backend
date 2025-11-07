import { 
  Controller, 
  Get,
  Post, 
  Patch,
  Delete,
  Body, 
  Param,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminRoles } from '../decorators/admin-role.decorator';
import { AdminInvitationService } from '../services/admin-invitation.service';
import { 
  CreateInvitationDto, 
  InvitationsQueryDto,
  InvitationResponseDto, 
  InvitationsPageResponse 
} from '../dto/invitation-admin.dto';

@ApiTags('admin-invitations')
@ApiBearerAuth('JWT-auth')
@Controller('admin/invitations')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminInvitationController {
  constructor(private adminInvitationService: AdminInvitationService) {}

  @Get()
  @ApiOperation({
    summary: 'List invitations (Admin/Manager)',
    description: 'Get paginated list of invitations for the current tenant with optional filters'
  })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'accepted', 'expired'] })
  @ApiQuery({ name: 'role', required: false, enum: ['DRIVER', 'MANAGER'] })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Items per page', example: 25 })
  @ApiResponse({
    status: 200,
    description: 'Invitations retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tenantId: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
              token: { type: 'string' },
              status: { type: 'string' },
              expiresAt: { type: 'string' },
              acceptedAt: { type: 'string' },
              invitedByName: { type: 'string' },
              driverProfileName: { type: 'string' }
            }
          }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async getInvitations(
    @Query(new ValidationPipe({ transform: true })) query: InvitationsQueryDto,

  ): Promise<InvitationsPageResponse> {
    return this.adminInvitationService.getInvitations(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get invitation by ID (Admin/Manager)',
    description: 'Get detailed information about a specific invitation'
  })
  @ApiParam({ name: 'id', description: 'Invitation ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @ApiResponse({
    status: 200,
    description: 'Invitation retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' },
        token: { type: 'string' },
        status: { type: 'string' },
        expiresAt: { type: 'string' },
        acceptedAt: { type: 'string' },
        invitedByName: { type: 'string' },
        driverProfileName: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async getInvitationById(
    @Param('id') invitationId: string,
  ): Promise<InvitationResponseDto> {
    return this.adminInvitationService.getInvitationById(invitationId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create invitation (Admin/Manager)',
    description: 'Create a new driver invitation for the current tenant'
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' },
        driverProfileId: { type: 'string' },
        status: { type: 'string' },
        expiresAt: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  async createInvitation(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) 
    createInvitationDto: CreateInvitationDto,
    @Request() req
  ): Promise<InvitationResponseDto> {
    const invitedByUserId = req.user.userId;
    return this.adminInvitationService.createInvitation(invitedByUserId, createInvitationDto);
  }

  @Patch(':id/resend')
  @ApiOperation({
    summary: 'Resend invitation (Admin/Manager)',
    description: 'Resend an existing invitation with a new token and expiry'
  })
  @ApiParam({ name: 'id', description: 'Invitation ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @ApiResponse({
    status: 200,
    description: 'Invitation resent successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' },
        token: { type: 'string' },
        status: { type: 'string' },
        expiresAt: { type: 'string' },
        acceptedAt: { type: 'string' },
        invitedByName: { type: 'string' },
        driverProfileName: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invitation already accepted' })
  async resendInvitation(
    @Param('id') invitationId: string,
  ): Promise<InvitationResponseDto> {
    return this.adminInvitationService.resendInvitation(invitationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel invitation (Admin/Manager)',
    description: 'Cancel a pending invitation'
  })
  @ApiParam({ name: 'id', description: 'Invitation ID', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @ApiResponse({ status: 204, description: 'Invitation cancelled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN or MANAGER role required' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invitation already accepted' })
  async cancelInvitation(
    @Param('id') invitationId: string,
  ): Promise<void> {
    await this.adminInvitationService.cancelInvitation(invitationId);
  }
}
