import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  CreateInvitationDto, 
  InvitationsQueryDto,
  InvitationResponseDto, 
  InvitationsPageResponse 
} from '../dto/invitation-admin.dto';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class AdminInvitationService {
  constructor(private prisma: PrismaService) {}

  async getInvitations(tenantId: string, query: InvitationsQueryDto): Promise<InvitationsPageResponse> {
    const { status, role, page = 1, pageSize = 25 } = query;

    // Build filter conditions
    const where: any = { tenantId };

    // Status filter
    if (status) {
      const now = new Date();
      switch (status) {
        case 'pending':
          where.acceptedAt = null;
          where.expiresAt = { gt: now };
          break;
        case 'accepted':
          where.acceptedAt = { not: null };
          break;
        case 'expired':
          where.acceptedAt = null;
          where.expiresAt = { lte: now };
          break;
      }
    }

    // Role filter
    if (role) {
      where.role = role as Role;
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Execute queries in parallel
    const [invitations, totalCount] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        skip,
        take,
        orderBy: { expiresAt: 'desc' },
        include: {
          invitedByUser: {
            select: {
              email: true
            }
          },
          driverProfile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      this.prisma.invitation.count({ where })
    ]);

    // Transform to response format
    const items: InvitationResponseDto[] = invitations.map(invitation => {
      const now = new Date();
      let status: string;
      
      if (invitation.acceptedAt) {
        status = 'accepted';
      } else if (invitation.expiresAt <= now) {
        status = 'expired';
      } else {
        status = 'pending';
      }

      return {
        id: invitation.id,
        tenantId: invitation.tenantId,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        status,
        expiresAt: invitation.expiresAt.toISOString(),
        acceptedAt: invitation.acceptedAt?.toISOString(),
        invitedByName: invitation.invitedByUser?.email || 'Unknown',
        driverProfileName: invitation.driverProfile 
          ? `${invitation.driverProfile.firstName} ${invitation.driverProfile.lastName}`
          : undefined,
        driverProfileId: invitation.driverProfileId || undefined
      };
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      items,
      total: totalCount,
      page,
      pageSize,
      totalPages
    };
  }

  async getInvitationById(tenantId: string, invitationId: string): Promise<InvitationResponseDto> {
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        tenantId
      },
      include: {
        invitedByUser: {
          select: {
            email: true
          }
        },
        driverProfile: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${invitationId} not found`);
    }

    const now = new Date();
    let status: string;
    
    if (invitation.acceptedAt) {
      status = 'accepted';
    } else if (invitation.expiresAt <= now) {
      status = 'expired';
    } else {
      status = 'pending';
    }

    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      status,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString(),
      invitedByName: invitation.invitedByUser?.email || 'Unknown',
      driverProfileName: invitation.driverProfile 
        ? `${invitation.driverProfile.firstName} ${invitation.driverProfile.lastName}`
        : undefined,
      driverProfileId: invitation.driverProfileId || undefined
    };
  }

  async createInvitation(
    tenantId: string, 
    invitedByUserId: string, 
    createInvitationDto: CreateInvitationDto
  ): Promise<InvitationResponseDto> {
    const { email, role, firstName, lastName, phone, driverProfileId } = createInvitationDto;

    // Check if there's already a pending invitation for this email
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        tenantId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvitation) {
      throw new BadRequestException(`A pending invitation already exists for ${email}`);
    }

    // Generate secure token and expiry (7 days from now)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // For DRIVER role, create or link driver profile
    let finalDriverProfileId = driverProfileId;
    
    if (role === 'DRIVER' && !driverProfileId) {
      if (!firstName || !lastName) {
        throw new BadRequestException('firstName and lastName are required when creating a new driver profile');
      }

      // Create new driver profile
      const driverProfile = await this.prisma.driverProfile.create({
        data: {
          tenantId,
          firstName,
          lastName,
          phone: phone || null,
          status: 'INVITED'
        }
      });
      
      finalDriverProfileId = driverProfile.id;
    }

    // Create the invitation
    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        email,
        role: role as Role,
        token,
        expiresAt,
        invitedByUserId,
        driverProfileId: finalDriverProfileId || null
      },
      include: {
        invitedByUser: {
          select: {
            email: true
          }
        },
        driverProfile: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      status: 'pending',
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: undefined,
      invitedByName: invitation.invitedByUser?.email || 'Unknown',
      driverProfileName: invitation.driverProfile 
        ? `${invitation.driverProfile.firstName} ${invitation.driverProfile.lastName}`
        : undefined,
      driverProfileId: invitation.driverProfileId || undefined
    };
  }

  async resendInvitation(tenantId: string, invitationId: string): Promise<InvitationResponseDto> {
    // Check if invitation exists and belongs to tenant
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        tenantId
      }
    });

    if (!existingInvitation) {
      throw new NotFoundException(`Invitation with ID ${invitationId} not found`);
    }

    if (existingInvitation.acceptedAt) {
      throw new BadRequestException('Cannot resend an already accepted invitation');
    }

    // Generate new token and expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Update the invitation
    const invitation = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token,
        expiresAt
      },
      include: {
        invitedByUser: {
          select: {
            email: true
          }
        },
        driverProfile: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      status: 'pending',
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString(),
      invitedByName: invitation.invitedByUser?.email || 'Unknown',
      driverProfileName: invitation.driverProfile 
        ? `${invitation.driverProfile.firstName} ${invitation.driverProfile.lastName}`
        : undefined,
      driverProfileId: invitation.driverProfileId || undefined
    };
  }

  async cancelInvitation(tenantId: string, invitationId: string): Promise<void> {
    // Check if invitation exists and belongs to tenant
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        tenantId
      }
    });

    if (!existingInvitation) {
      throw new NotFoundException(`Invitation with ID ${invitationId} not found`);
    }

    if (existingInvitation.acceptedAt) {
      throw new BadRequestException('Cannot cancel an already accepted invitation');
    }

    // Delete the invitation
    await this.prisma.invitation.delete({
      where: { id: invitationId }
    });
  }
}
