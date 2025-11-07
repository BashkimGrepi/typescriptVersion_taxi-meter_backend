import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";


@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // extend request with helper methods
        (req as any).getTenantId = () => {
            const user = (req as any).user;
            if (!user?.tenantId) {
                throw new ForbiddenException("No tenant context in request");
            }
            return user.tenantId;
        };

        (req as any).getCurrentUserId = () => {
            const user = (req as any).user;
            if (!user?.userId) {
                throw new ForbiddenException("No user context in request");
            }
            return user.userId;
        };

        (req as any).requireRole = (allowedRoles: string[]) => {
            const user = (req as any).user;
            if (!user?.role || !allowedRoles.includes(user.role)) {
                throw new ForbiddenException("Insufficient permissions");
            }
        };

        (req as any).requireAdminOrManager = () => {
            const user = (req as any).user;
            if (!user?.role || !['ADMIN', 'MANAGER'].includes(user.role)) {
                throw new ForbiddenException("Admins/Managers only");
            }
        };

        next();
    }
}