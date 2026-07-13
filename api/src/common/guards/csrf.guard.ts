import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Synchronizer-token CSRF protection, complementing sameSite=lax cookies:
// every mutating request must echo the session's token in X-CSRF-Token.
// @Public() routes are exempt (login has no session/token yet).
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const header = request.get('x-csrf-token');
    if (!header || header !== request.session?.csrfToken) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
