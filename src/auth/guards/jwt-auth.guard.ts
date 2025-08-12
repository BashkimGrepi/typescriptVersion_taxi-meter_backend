import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Explicit protection

// Simple JWT guard for specific endpoints
// Used with @UseGuards(JwtAuthGuard) on specific routes
// Simpler than global guard (no @Public() support)
// Enforces JWT requirement on decorated endpoints

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}