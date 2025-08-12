import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from 'src/decorators/public.decorator';

// Global protection
// Protects ALL endpoints by default, expect those marked with @Public()
// Applied globally in main.ts
// Checks every request for valid JWT token
// Allow @Public() to bypass JWT validation
// Automatically rejects requests without valid tokens
@Injectable()
export class JwtGlobalGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) return true;
    
    return super.canActivate(context);
  }
}