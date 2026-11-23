import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Role-based access by HTTP method, after JwtAuthGuard set request.user:
//   viewer: read only
//   editor: read, create and edit; never delete
//   owner:  everything
// Managing people is owner-only on top of this (MembersService).
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const { role } = request.user!;
    if (READ_METHODS.has(request.method) || role === 'owner') return true;
    if (role === 'editor' && request.method !== 'DELETE') return true;
    throw new ForbiddenException('Your role does not allow this action');
  }
}
