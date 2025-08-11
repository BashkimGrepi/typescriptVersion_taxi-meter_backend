import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface DriverInfo {
  userId: string;
  email: string;
  driverProfileId: string;
  tenantId: string;
  role: string;
  type: string;
}

export const Driver = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): DriverInfo => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Ensure this is a driver user
    if (!user || user.type !== 'driver') {
      throw new Error('Not a driver user');
    }

    return {
      userId: user.sub,
      email: user.email,
      driverProfileId: user.driverProfileId,
      tenantId: user.tenantId,
      role: user.role,
      type: user.type
    };
  },
);
