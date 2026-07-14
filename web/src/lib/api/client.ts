// Thin transport for the API: same-origin fetch with the session cookie,
// CSRF header on mutating requests, and the API's single error shape
// normalized into ApiError (see api/ HttpExceptionFilter).

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

// The CSRF token is returned by login/me and kept in memory only (the
// session itself lives in the httpOnly cookie).
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
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

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = new Headers();
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  if (method !== 'GET' && csrfToken) {
    headers.set('x-csrf-token', csrfToken);
  }

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    body,
    credentials: 'include',
  });

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

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
