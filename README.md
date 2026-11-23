# Farm Management

Application to manage livestock farms: farms, animals, and the running record
of everything that happens to each animal over time — weight, health,
reproduction, movements, and notes. Web-first and responsive, built to be
usable on a phone in the field.

## Repository layout

Backend and frontend live in this single repository, separated by top-level
folders, and are deployed independently. The backend API is the contract
(OpenAPI); clients are thin.

| Folder  | Contents                                                           |
| ------- | ------------------------------------------------------------------ |
| `docs/` | Project plan, visual design spec, design tokens, and HTML mockups  |
| `api/`  | Backend — NestJS + Prisma + PostgreSQL                             |
| `web/`  | Frontend — React + Vite + Tailwind + shadcn/ui (Spanish-first SPA) |

See `docs/project-plan.md` for goals, architecture, data model, and roadmap.

## Quick start (API)

```bash
cd api
cp .env.example .env    # fill in local credentials
docker compose up -d    # PostgreSQL 17; db/schema.sql auto-applied on first boot
pnpm install
pnpm seed               # seed the organization and owner user (SEED_* vars)
pnpm start:dev          # → http://localhost:3000/api/v1/health
```

Swagger UI at `http://localhost:3000/api/docs`.

## Quick start (web)

With the API running:

```bash
cd web
pnpm install
pnpm dev                # → http://localhost:5173 (proxies /api to :3001)
```

Log in with the seeded owner user. The MVP covers the herd dashboard, animals
with per-animal records (weights, health events, notes), farms, breeds, and
CSV herd import — see `web/README.md` for details.
