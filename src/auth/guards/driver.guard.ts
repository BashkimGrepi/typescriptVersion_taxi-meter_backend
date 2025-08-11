import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { DriverProfileService } from '../../drivers/driver-profile.service';

@Injectable()
export class DriverGuard implements CanActivate {
  private readonly logger = new Logger(DriverGuard.name);
  
  constructor(private driverProfileService: DriverProfileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.debug('DriverGuard - Checking user access');
    this.logger.debug('User object:', JSON.stringify(user, null, 2));

    // Check if user is authenticated and is a driver
    if (!user) {
      this.logger.error('No user found in request');
      throw new ForbiddenException('Access restricted to drivers only');
    }

    if (user.type !== 'driver') {
      this.logger.error(`User type is '${user.type}', expected 'driver'`);
      throw new ForbiddenException('Access restricted to drivers only');
    }

    // Validate driver access (active status, profile exists, etc.)
    const driverInfo = {
      userId: user.sub,
      email: user.email,
      driverProfileId: user.driverProfileId,
      tenantId: user.tenantId,
      role: user.role,
      type: user.type
    };

    this.logger.debug('Driver info:', JSON.stringify(driverInfo, null, 2));

    const hasAccess = await this.driverProfileService.validateDriverAccess(driverInfo);
    
    this.logger.debug('Driver access validation result:', hasAccess);

    if (!hasAccess) {
      this.logger.error('Driver access denied by profile service');
      throw new ForbiddenException('Driver access denied. Profile may be inactive or not found.');
    }

    this.logger.debug('DriverGuard - Access granted');
    return true;
  }
}
