import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AdminInfo {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  role: string;
  type: string;
}

export const Admin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AdminInfo => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Ensure this is an admin user
    if (!user || user.role !== 'ADMIN') {
      throw new Error('Not an admin user');
    }

    return {
      userId: user.sub,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenantName || '', // Available in admin tokens
      role: user.role,
      type: user.type || 'access'
    };
  },
);
