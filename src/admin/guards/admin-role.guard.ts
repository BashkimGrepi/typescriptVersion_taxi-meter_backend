import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Ensure user has admin role and valid tenant context
    if (!user?.role || !user?.tenantId) {
      throw new ForbiddenException('Missing authentication context');
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}
