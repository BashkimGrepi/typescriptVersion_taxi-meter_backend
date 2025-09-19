import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtValidationResult } from '../interfaces/jwt-payload.interface';

@Injectable()
export class DriverV1Guard extends AuthGuard('jwt-v1') implements CanActivate {
  private readonly logger = new Logger(DriverV1Guard.name);


  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      this.logger.log('DriverV1Guard - Starting authentication');

      // calling the parent canActivate which uses our 'jwt-v1' strategy
      const result = await super.canActivate(context);

      if (!result) {
        this.logger.warn('DriverV1Guard - JWT Authentication failed');
        return false;
      }
      
      //additional authorization logic can go here if needed
      const request = context.switchToHttp().getRequest();
      const user: JwtValidationResult = request.user;

      this.logger.log(`DriverV1Guard: Authentication successful for user: ${user.sub}, tenant: ${user.tenantId}`);

      return true;
    } catch (error) {
      this.logger.error('DriverV1Guard - Error during authentication', error.stack);
      return false;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Custom error handling
    if (err || !user) {
      this.logger.warn(`DriverV1Guard: Authentication failed - ${err?.message || info?.message || 'Unknown error'}`);
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    
    this.logger.log(`DriverV1Guard: User authenticated successfully: ${user.sub}`);
    return user;
  }
}
