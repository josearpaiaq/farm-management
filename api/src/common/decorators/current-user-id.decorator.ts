import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// SessionAuthGuard guarantees a session on every non-@Public route.
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.session.userId!;
  },
);
