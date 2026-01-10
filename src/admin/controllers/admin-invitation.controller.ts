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
import { UniversalV1Guard } from '../../auth/guards/universal-v1.guard';
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
@UseGuards(UniversalV1Guard)
@AdminRoles('ADMIN', 'MANAGER')
export class AdminInvitationController {
  constructor(private adminInvitationService: AdminInvitationService) {}

  @Get()
  async getInvitations(
    @Query(new ValidationPipe({ transform: true })) query: InvitationsQueryDto,

  ): Promise<InvitationsPageResponse> {
    return this.adminInvitationService.getInvitations(query);
  }

  @Get(':id')
  async getInvitationById(
    @Param('id') invitationId: string,
  ): Promise<InvitationResponseDto> {
    return this.adminInvitationService.getInvitationById(invitationId);
  }

  @Post()
  async createInvitation(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) 
    createInvitationDto: CreateInvitationDto,
    @Request() req
  ): Promise<InvitationResponseDto> {
    const invitedByUserId = req.user.userId;
    return this.adminInvitationService.createInvitation(invitedByUserId, createInvitationDto);
  }

  @Patch(':id/resend')
  async resendInvitation(
    @Param('id') invitationId: string,
  ): Promise<InvitationResponseDto> {
    return this.adminInvitationService.resendInvitation(invitationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelInvitation(
    @Param('id') invitationId: string,
  ): Promise<void> {
    await this.adminInvitationService.cancelInvitation(invitationId);
  }
}
