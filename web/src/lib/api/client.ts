// Thin transport for the API: same-origin fetch with a bearer access token,
// transparent refresh on 401, and the API's single error shape normalized
// into ApiError (see api/ HttpExceptionFilter).
//
// Tokens: the short-lived access token lives in memory only (never in
// storage, so XSS cannot lift it from there). The long-lived refresh token is
// an httpOnly cookie scoped to /api/v1/auth that JavaScript never sees; on a
// reload the access token is gone and the first 401 triggers a refresh.

export const API_BASE = '/api/v1';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: FieldError[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: FieldError[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Another tab may rotate the shared refresh cookie a moment before us; the
// API rejects our now-stale token, so retry once with the fresh cookie.
const REFRESH_RETRY_DELAY_MS = 300;
let refreshing: Promise<boolean> | null = null;

// Swaps the refresh cookie for a new access token. Concurrent callers share
// one in-flight refresh, since each refresh rotates (invalidates) the cookie.
export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, REFRESH_RETRY_DELAY_MS),
        );
      }
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => null);
      if (response?.ok) {
        const body = (await response.json()) as { access_token: string };
        accessToken = body.access_token;
        return true;
      }
    }
    accessToken = null;
    return false;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: object;
  body?: unknown;
}

function buildUrl(path: string, query?: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (
      typeof value === 'string' ? value !== '' : value !== undefined && value !== null
    ) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

// Auth endpoints answer 401 for bad credentials or codes, not for an expired
// access token, so refreshing would be pointless there. /auth/me is the
// exception: it is how the app restores a login after a page reload.
function canRefreshOn(path: string): boolean {
  return !path.startsWith('/auth/') || path === '/auth/me';
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const method = options.method ?? 'GET';
  const doFetch = () => {
    const headers = new Headers();
    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: 'include',
    });
  };

  let response = await doFetch();
  if (response.status === 401 && canRefreshOn(path)) {
    if (await refreshAccessToken()) response = await doFetch();
  }

  if (!response.ok) {
    const fallback = {
      statusCode: response.status,
      error: 'internal_error',
      message: response.statusText,
    };
    const payload = (await response.json().catch(() => fallback)) as {
      statusCode: number;
      error: string;
      message: string;
      details?: FieldError[];
    };
    throw new ApiError(
      response.status,
      payload.error,
      payload.message,
      payload.details,
    );
  }
  return response;
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// Authenticated file download. A plain <a href> cannot carry the bearer
// token, so fetch the file and hand the browser a temporary object URL.
export async function download(path: string, filename: string): Promise<void> {
  const blob = await (await send(path, {})).blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
