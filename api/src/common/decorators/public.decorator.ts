import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marks a route (or whole controller) as reachable without an access token.
// Everything else is denied by default by JwtAuthGuard.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
