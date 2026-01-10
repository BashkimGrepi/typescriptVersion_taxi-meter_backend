import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

@Injectable()
export class TenantScopedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip tenant validation for public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // ensure all authenticated requests have valid tenant context
    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context in request');
    }

    // validate tenant consistency if needed
    const requiredTenantId = this.reflector.get<string>(
      'tenantId',
      context.getHandler(),
    );
    if (requiredTenantId && requiredTenantId !== user.tenantId) {
      throw new ForbiddenException('Tenant mismatch in request');
    }

    return true;
  }
}
