import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { JwtValidationResult } from '../interfaces/jwt-payload.interface';

@Injectable()
export class UniversalV1Guard
  extends AuthGuard('jwt-v1')
  implements CanActivate
{
  private readonly logger = new Logger(UniversalV1Guard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check if endpoint is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.log(
        'UniversalV1Guard - Public endpoint, skipping authentication',
      );
      return true; // skip authentication for @Public() endpoints
    }

    // 2. For protected endpoints, run JWT authentication
    try {
      this.logger.log(
        'UniversalV1Guard - Starting authentication for protected endpoint',
      );

      const result = await super.canActivate(context);

      if (!result) {
        this.logger.warn('UniversalV1Guard - JWT Authentication failed');
        return false;
      }

      const request = context.switchToHttp().getRequest();
      const user: JwtValidationResult = request.user;

      this.logger.log(
        `UniversalV1Guard: Authentication successful for user: ${user.sub}, tenant: ${user.tenantId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        'UniversalV1Guard - Error during authentication',
        error.stack,
      );
      return false;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Custom error handling for protected endpoints only
    if (err || !user) {
      this.logger.warn(
        `UniversalV1Guard: Authentication failed - ${err?.message || info?.message || 'Unknown error'}`,
      );
      throw err || new UnauthorizedException('Invalid or expired token');
    }

    this.logger.log(
      `UniversalV1Guard: User authenticated successfully: ${user.sub}`,
    );
    return user;
  }
}
