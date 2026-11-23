import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Tenancy is derived from the verified access token, never from the request
// payload (see plan, Architecture). JwtAuthGuard guarantees request.user on
// every non-@Public route, so the value is always present here.
export const CurrentOrgId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.user!.organizationId;
  },
);
