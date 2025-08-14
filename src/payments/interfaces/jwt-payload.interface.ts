
export interface JwtPayload {
    sub: string;
    email: string;
    roles: Array<{
        role: 'ADMIN' | 'MANAGER' | 'DRIVER';
        tenantId: string;
    }>;
    iat: number;
    exp: number;
}