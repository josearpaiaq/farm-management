# Web — Farm Management Frontend

React SPA for the farm management MVP: herd dashboard, animals with per-animal
records (weights, health events, notes), farms, breeds catalog, and CSV herd
import. Spanish-first UI, responsive down to phone size (768px breakpoint:
sidebar becomes a drawer, tables become cards).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui, themed from `docs/design/tokens.css` (earthy
  light palette) in `src/index.css`
- TanStack Query for server state; nuqs for URL-synced list filters
- react-router-dom, react-hook-form, i18next (Spanish shipped first)
- Hand-written typed API client in `src/lib/api/` (session cookie +
  `x-csrf-token` header, normalized error shape). Generating the client from
  the API's OpenAPI document is planned once the API declares response DTOs.

## Development

Requires the API running (see `../api`, listens on the port set in its `.env`)
and its PostgreSQL database.

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # typecheck + production build into dist/
```

The dev server proxies `/api` to `http://localhost:3000` (see
`vite.config.ts`), so the session cookie works same-origin. If your API runs
on another port, set `API_PROXY_TARGET` in a local `web/.env` (gitignored).
Log in with the user seeded by `pnpm seed` in `../api`.

## Structure

```
src/
  app/          router, app shell (sidebar/drawer layout)
  components/   shared UI (status badge, page header, vocab select, ...)
    ui/         shadcn/ui primitives
  features/     one folder per domain: auth, dashboard, animals, farms,
                breeds, imports — each with its query hooks (api.ts) and pages
  lib/          API transport + contract types, formatting, form error mapping
  locales/      es.json (all UI strings and vocabulary labels)
```
