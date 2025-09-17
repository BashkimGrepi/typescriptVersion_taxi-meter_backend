import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthenticatedUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return {
      userId: request.user.sub,
      email: request.user.email,
      role: request.user.role,
      tenantId: request.user.tenantId,
      driverProfileId: request.user.driverProfileId, // Only for drivers
    };
  },
);

export interface AuthenticatedUserInfo {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  tenantId: string;
  driverProfileId?: string; // Only present for drivers
}