export interface AdminProfileData {
    id: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE';
    passwordHash: string;
    createdAt: string;
    
    // role and tenant info (from membership + tenant)
    role: 'ADMIN' | 'MANAGER';
    tenantId: string;
    tenantName: string;
    businessId: string;

    // computed stats
    driverCount: number;
    totalInvitationsSent?: number;
    lastLoginAt?: string;
}
