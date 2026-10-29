import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import type { AccessTokenPayload } from '../../auth/tokens.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Default-deny: every route requires a valid access token in the
// `Authorization: Bearer` header unless @Public(). Bearer tokens are never
// sent automatically by browsers, so these routes need no CSRF protection.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (request.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      request.user = { userId: payload.sub, organizationId: payload.org };
    } catch {
      // Expired or tampered: the client should refresh and retry.
      throw new UnauthorizedException();
    }
    return true;
  }
}
