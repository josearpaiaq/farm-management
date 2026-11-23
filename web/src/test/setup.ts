import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import '@/i18n';
import { setAccessToken } from '@/lib/api/client';
import { server } from '@/test/server';

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  // The app calls same-origin relative URLs ('/api/v1/...'), which Node's
  // fetch rejects. Resolve them against the jsdom origin, after MSW has
  // patched fetch so its interceptor still sees every request.
  const patchedFetch = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    patchedFetch(
      typeof input === 'string' && input.startsWith('/')
        ? new URL(input, window.location.origin)
        : input,
      init,
    );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  setAccessToken(null);
});

afterAll(() => server.close());
