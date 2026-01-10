import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";




@Injectable()
export abstract class TenantScopedService {
    constructor(@Inject(REQUEST) private request: Express.Request) { }
    
    protected getCurrentTenantId(): string {
        const user = (this.request as any).user;
        if (!user?.tenantId) {
            throw new ForbiddenException("No tenant context in request");
        }
        return user.tenantId;
    }

    protected getCurrentUserId(): string {
        const user = (this.request as any).user;
        if (!user?.userId) {
            throw new ForbiddenException("No user context in request");
        }
        return user.userId;
    }

    protected getCurrentUserRole(): string {
        const user = (this.request as any).user;
        return user.role || 'UNKNOWN';
    }
}