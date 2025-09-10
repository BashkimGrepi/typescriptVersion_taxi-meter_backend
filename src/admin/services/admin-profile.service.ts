import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminOrManagerInfo } from "../../decorators/admin-or-manager.decorator";
import { AdminProfileResponseDto } from "../dto/admin-profile-response.dto";


@Injectable()   
export class AdminProfileService {
    constructor(private readonly prisma: PrismaService) { }
    async getAdminProfile(adminInfo: AdminOrManagerInfo): Promise<AdminProfileResponseDto> {

        // Step 1: Fetch user data
        const user = await this.prisma.user.findUnique({
            where: { id: adminInfo.userId },
            select: {
                id: true,
                email: true,
                status: true,
                createdAt: true,
            }
        });
        if (!user) throw new NotFoundException('User not found');

        // Step 2: Fetch membership data
        const membership = await this.prisma.membership.findFirst({
            where: {
                userId: adminInfo.userId,
                tenantId: adminInfo.tenantId
            },
            select: {
                role: true,
                createdAt: true,
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        businessId: true
                    }
                }
            }
        });
        if (!membership) throw new NotFoundException('Membership not found');

        // Step 3: Calculate statistics
        // Promise.all used to run queries in parallel for efficiency
        const [driverCount, invitationCount] = await Promise.all([
            // count drivers in current tenant
            this.prisma.driverProfile.count({
                where: { tenantId: adminInfo.tenantId }
            }),
            // count invitations sent by this admin
            this.prisma.invitation.count({
                where: { invitedByUserId: adminInfo.userId }
            })
        ]);

        // Step 4: Build and return response
        const profileData = {
            id: user.id,
            email: user.email,
            status: user.status,
            accountCreatedAt: user.createdAt.toISOString(),
            role: membership.role,
            tenantId: adminInfo.tenantId,
            tenantName: membership.tenant.name,
            bussinessId: membership.tenant.businessId,
            joinedTenantAt: membership.createdAt.toISOString(),
            stats: {
                totalDriversManaged: driverCount,
                totalInvitationsSent: invitationCount,
                lastLogin: undefined // TODO: implement last login tracking
            }
        };
        return new AdminProfileResponseDto(profileData);
    }
}
