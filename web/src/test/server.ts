import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const API = `${window.location.origin}/api/v1`;

export const testUser = {
  id: 'user-1',
  email: 'owner@test.local',
  full_name: 'Owner',
  role: 'owner',
  organization_id: 'org-1',
};

// Default: nobody is signed in (no access token, no refresh cookie).
// Tests override handlers with server.use(...) for their scenario.
export const server = setupServer(
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({ statusCode: 401, error: 'unauthorized' }, { status: 401 }),
  ),
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ statusCode: 401, error: 'unauthorized' }, { status: 401 }),
  ),
);
