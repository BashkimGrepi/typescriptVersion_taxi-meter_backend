export class AdminProfileResponseDto {
    id: string;
    email: string;
    username?: string;
    status: string;
    accountCreatedAt: string;
    role: string;
    tenantId: string;
    tenantName: string;
    businessId: string;
    joinedTenantAt?: string;
    stats: {
        totalDriversManaged: number;
        totalInvitationsSent: number;
        lastLogin?: string;
    }

    constructor(data: any) {
        this.id = data.id;
        this.email = data.email;
        this.username = data.username;
        this.status = data.status;
        this.accountCreatedAt = data.accountCreatedAt;
        this.role = data.role;
        this.tenantId = data.tenantId;
        this.tenantName = data.tenantName;
        this.businessId = data.bussinessId; // Note: keeping the typo from original
        this.joinedTenantAt = data.joinedTenantAt;
        this.stats = data.stats;
    }
}
