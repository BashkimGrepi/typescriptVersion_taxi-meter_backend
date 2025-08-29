import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AdminOrManagerInfo {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  role: 'ADMIN' | 'MANAGER';
  type: string;
}

export const AdminOrManager = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AdminOrManagerInfo => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Ensure this is an admin or manager user
    if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
      throw new Error('Access denied. Admin or Manager role required');
    }

    return {
      userId: user.sub,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenantName || '', // Available in admin/manager tokens
      role: user.role as 'ADMIN' | 'MANAGER',
      type: user.type || 'access'
    };
  },
);
