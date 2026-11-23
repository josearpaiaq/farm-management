import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { api, ApiError, setAccessToken } from '@/lib/api/client';
import { API, server } from '@/test/server';

const unauthorized = () =>
  HttpResponse.json(
    { statusCode: 401, error: 'unauthorized', message: 'Unauthorized' },
    { status: 401 },
  );

// /farms answers 200 only for `Bearer <valid>`, like an expired-token API.
function farmsRequiring(valid: string) {
  return http.get(`${API}/farms`, ({ request }) =>
    request.headers.get('Authorization') === `Bearer ${valid}`
      ? HttpResponse.json({ data: [], total: 0 })
      : unauthorized(),
  );
}

describe('api client', () => {
  it('sends the access token as a bearer header', async () => {
    setAccessToken('valid');
    server.use(farmsRequiring('valid'));

    await expect(api('/farms')).resolves.toEqual({ data: [], total: 0 });
  });

  it('refreshes on 401 and retries with the new access token', async () => {
    setAccessToken('expired');
    server.use(
      farmsRequiring('fresh'),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ access_token: 'fresh' }),
      ),
    );

    await expect(api('/farms')).resolves.toEqual({ data: [], total: 0 });
  });

  it('shares a single refresh between concurrent requests', async () => {
    let refreshes = 0;
    setAccessToken('expired');
    server.use(
      farmsRequiring('fresh'),
      http.post(`${API}/auth/refresh`, () => {
        refreshes++;
        return HttpResponse.json({ access_token: 'fresh' });
      }),
    );

    await Promise.all([api('/farms'), api('/farms'), api('/farms')]);
    expect(refreshes).toBe(1);
  });

  it('fails with the 401 when the refresh token is rejected too', async () => {
    setAccessToken('expired');
    server.use(farmsRequiring('fresh'));

    const error = await api('/farms').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
  });

  it('does not refresh when credentials are wrong on login', async () => {
    let refreshes = 0;
    server.use(
      http.post(`${API}/auth/login`, unauthorized),
      http.post(`${API}/auth/refresh`, () => {
        refreshes++;
        return unauthorized();
      }),
    );

    await expect(
      api('/auth/login', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({ status: 401 });
    expect(refreshes).toBe(0);
  });
});
