import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    // Tenancy is derived from the session, never from the request (see plan).
    organizationId: string;
    // Synchronizer token echoed by clients in the X-CSRF-Token header.
    csrfToken: string;
  }
}
