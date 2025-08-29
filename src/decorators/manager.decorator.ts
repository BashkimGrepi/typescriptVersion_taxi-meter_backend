import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface ManagerInfo {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  role: string;
  type: string;
}

export const Manager = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ManagerInfo => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Ensure this is a manager user
    if (!user || user.role !== 'MANAGER') {
      throw new Error('Not a manager user');
    }

    return {
      userId: user.sub,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenantName || '', // Available in manager tokens
      role: user.role,
      type: user.type || 'access'
    };
  },
);
