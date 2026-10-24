export {};

declare global {
  namespace Express {
    interface Request {
      // Set by JwtAuthGuard from a verified access token. Tenancy is derived
      // from the token, never from the request payload (see plan).
      user?: { userId: string; organizationId: string };
    }
  }
}
