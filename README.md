# Farm Management

Application to manage livestock farms: farms, animals, and the running record
of everything that happens to each animal over time — weight, health,
reproduction, movements, and notes. Web-first and responsive, built to be
usable on a phone in the field.

## Repository layout

Backend and frontend live in this single repository, separated by top-level
folders, and are deployed independently. The backend API is the contract
(OpenAPI); clients are thin.

| Folder  | Contents                                                            |
| ------- | ------------------------------------------------------------------- |
| `docs/` | Project plan, visual design spec, design tokens, and HTML mockups   |
| `api/`  | Backend — NestJS + Prisma + PostgreSQL                              |
| `web/`  | Frontend — React + Vite + Tailwind (not started yet)                |

See `docs/project-plan.md` for goals, architecture, data model, and roadmap.

## Quick start (API)

```bash
cd api
cp .env.example .env    # fill in local credentials
docker compose up -d    # PostgreSQL 17; db/schema.sql auto-applied on first boot
pnpm install
pnpm start:dev          # → http://localhost:3000/api/v1/health
```
