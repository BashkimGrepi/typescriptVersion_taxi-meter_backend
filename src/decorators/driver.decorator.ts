import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export interface DriverInfo {
  userId: string;
  tenantId: string;
  tenantName: string;
  driverProfileId: string;
  role: "DRIVER";
  type: 'access';
}

export const Driver = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): DriverInfo => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Ensure this is a driver user (check role and driverProfileId)
    if (!user || user.role !== 'DRIVER' || !user.driverProfileId) {
      console.log('Not a driver user:', user);
      throw new UnauthorizedException('Not a driver user');
    }

    return {
      userId: user.sub,
      tenantId: user.tenantId,
      tenantName: user.tenantName,
      driverProfileId: user.driverProfileId,
      role: user.role,
      type: user.type || 'access'
    };
  },
);
