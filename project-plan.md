# Project Plan

## Goals

Build an application to manage livestock farms. Users register their farms and
the animals in them, and keep a running record of what happens to each animal
over time: weight, health interventions, reproduction, movements, and notes.
The system must work on a real, operating farm, so usability on a phone in the
field matters as much as the feature list.

The application is web-first and responsive, with a clean separation between
business logic and presentation so it can be extended to mobile or desktop
later. The backend API is the contract: the web client (and any future mobile
client) consume the same API.

This is initially built to modernize a family farm, with the secondary goal of
being offered to other farms later. The architecture is therefore single-tenant
in practice for the MVP but multi-tenant by design (see Multi-tenancy).

## Tech Stack

The original Go/Gin stack was replaced with a TypeScript stack to match existing
expertise and reduce project risk. The decision was made before any backend code
was written, so the database schema and API contract carry over unchanged.

**Backend**
- NestJS (Node.js, TypeScript) — layered structure (controllers → services →
  repositories) that maps to the required separation of concerns.
- PostgreSQL as the database.
- Prisma as the ORM. The existing `schema.sql` can be introspected with
  `prisma db pull` to bootstrap the Prisma schema. (Drizzle is a lighter,
  SQL-first alternative if more control over queries is wanted later.)
- Server-side sessions stored in an httpOnly, Secure cookie for authentication
  (see Security for the JWT-vs-session rationale).
- Validation with Zod (or class-validator). CSRF protection on all mutating
  requests.

**Frontend**
- React with Vite, TypeScript (mandatory).
- Tailwind CSS, shadcn/ui components, lucide-react icons, motion for animation.
- react-router-dom for routing, react-hook-form for forms.
- TanStack Query for server state (fetching, caching, invalidation) — this is
  the primary data layer for a data-heavy CRUD app.
- nuqs for URL-synchronized state (list filters, pagination), and Zustand only
  if ephemeral client state is needed. These complement TanStack Query; they do
  not replace it.
- i18n for translations (Spanish first; see Internationalization).
- HTTP via a generated, typed API client (see Contract & Repos).

**Database**
- PostgreSQL.

## Contract & Repos

Backend and frontend live in **separate repositories**.

Because the repos are separate, the API contract is shared via **OpenAPI**, not
a shared TypeScript package: NestJS emits an OpenAPI document (code-first with
`@nestjs/swagger`, using the hand-written `openapi.yaml` as the blueprint), and
the frontend generates a typed client from it (`openapi-typescript` or `orval`).
Both ends stay in sync through that generated client.

If full type/validation sharing (shared Zod schemas, shared domain logic) becomes
worth the tooling overhead later, the path is to move to a monorepo (pnpm
workspaces + Turborepo) with a `shared` package. This is intentionally deferred.

## Architecture

- **API as the contract.** All business logic lives behind the API; clients are
  thin. Layering: controllers (HTTP) → services (business logic) → repositories
  (Prisma/data access).
- **Tenancy from the session.** The organization is derived from the
  authenticated session, never from the request. Resources are flat
  (`/animals`, not `/orgs/{id}/animals`), so a client can only ever access its
  own organization's data.
- **Event-sourced domain.** Anything that changes over time (weight, health,
  reproduction, production, movement) is an append-only event row, never an
  `UPDATE` that overwrites history. This is what makes reporting and traceability
  cheap to add later.

## Data Model

The authoritative schema is `schema.sql` (PostgreSQL DDL). Summary of entities:

- **organizations** — the tenant boundary.
- **roles** — isolated lookup table (`id`, `name`), seeded with `owner` and
  `member`, instead of a text/enum column on `users`. Both roles have the same
  permissions for the MVP; the isolated table is so a `permissions` table (or
  a `role_permissions` join) can be added later to make roles fine-grained
  without a schema change to `users` (see Roles under Later).
- **users** — org-scoped, with a `role_id` FK into `roles`.
- **farms** — physical locations owned by the organization.
- **breeds** — per-organization catalog, scoped to a species.
- **animals** — core entity. Carries only slow-changing attributes (species,
  sex, breed, birth date, tenure, status, parents). Age is derived from
  `birth_date`. Genealogy via self-referential `sire_id` / `dam_id`.
- **animal_identifiers** — multiple identifiers per animal (visual tag, RFID/EID,
  tattoo, brand, registration); tags are mutable, the internal UUID is identity.
- **weight_records** — time-series weights → growth curves and average daily gain.
- **health_events** — vaccinations, treatments, etc., including a
  `withdrawal_until` date (period before the animal/milk can be sold).
- **breeding_events** — reproductive cycle (heat, service, pregnancy check,
  calving, abortion, weaning).
- **movements** — animal movements between farms (traceability).
- **production_records** — milk production. Hangs off the farm (farm-level totals
  today); `animal_id` is nullable so per-animal measurement can be added later
  with no schema change.
- **notes** — free-text notes per animal.

Key conventions: UUID primary keys (generated as UUIDv7 client-side for
offline/sortability; `gen_random_uuid()` as a server-side fallback); controlled
vocabularies (status, sex, tenure, event types) stored as text codes guarded by
`CHECK` constraints, with human-readable labels resolved in the frontend i18n;
`status` (active / sold / dead / culled / transferred) drives the animal
lifecycle instead of hard deletes; `deleted_at` reserved only for records created
in error; `updated_at` maintained by trigger (used later for offline conflict
resolution).

## Security

- **Sessions over JWT.** For a single backend, server-side sessions in an
  httpOnly, Secure cookie are simpler and safer than JWT in `localStorage`
  (no XSS token theft, easy revocation on logout/role change). The statelessness
  benefit of JWT is not needed at this scale.
- **CSRF.** Because auth is cookie-based, all state-changing requests require an
  `X-CSRF-Token` header.
- **Object-level authorization (IDOR) is the primary risk.** Every query is
  scoped to the session's `organization_id`; this is enforced centrally so a
  forgotten filter cannot leak another tenant's data. This matters more than the
  usual OWASP checklist.
- **SQL injection** is handled by Prisma's parameterized queries (no string
  concatenation). **XSS** is handled by React's output escaping (no
  `dangerouslySetInnerHTML`).
- Passwords hashed with argon2id (or bcrypt). Rate limiting on auth endpoints.
  Server-side validation on every input; never trust the client.
- **Defense in depth (later):** PostgreSQL Row-Level Security once multi-tenant
  isolation is enforced for real.

All security handling is documented in the code, in English.

## Features

### MVP

- Authentication (single organization) with session + CSRF.
- Farms: create, list, view, edit, delete (rejected if the farm still has
  animals).
- Breeds: per-organization catalog (list, create).
- Animals: register and manage, with species, sex, breed, birth date, tenure
  (owned / leased), status, primary tag, and parent links (sire/dam captured
  from day one, since lineage cannot be reconstructed retroactively).
- Weight logging (per animal).
- Health logging (per animal), including withdrawal dates.
- Notes (per animal).
- CSV bulk import of an existing herd (see CSV Import) — required for adoption.
- Minimal herd stats (counts by status and species).
- Responsive UI (usable on a phone in the field).
- i18n wired from day one (Spanish shipped first).

### Later

- Breeding / reproduction cycle workflow.
- Milk production tracking (farm-level first; per-animal optional later).
- Movements between farms.
- Reporting and analytics dashboards (growth curves, herd composition, etc.).
- Fine-grained permissions per role (owner vs. member), via a `permissions` /
  `role_permissions` table hanging off `roles`.
- Multi-tenant isolation enforcement (RLS) and onboarding of other farms.
- Offline support (see Offline).
- Subscriptions / billing and notifications.

## CSV Import

The initial herd load is part of the MVP because nothing else is useful until the
existing animals are in the system. Design:

- **Two-phase.** A dry-run validates and parses the entire file and returns a
  per-row report without writing anything; a separate commit step then applies
  the valid rows. (A one-shot validate-and-commit mode is also supported.)
- **Idempotent via natural key.** The animal's identifier (tag) is the natural
  key within an organization. Commit upserts on `(organization_id, tag)` and
  **skips animals that already exist**, so re-uploading the same file never
  duplicates. This makes "fix the bad rows and re-upload the whole file" safe.
- **Strong validation.** Hard fields (unique tag present, valid species, sex,
  resolvable farm) reject the row; soft fields (birth date, breed, tenure) are
  parsed or defaulted. Format checks catch unparseable dates/numbers, unknown
  codes, and absurd values (future birth date, negative weight).
- **Partial import with report.** Valid rows import, invalid rows are skipped,
  and a downloadable per-row report explains each failure. One bad row does not
  block the good ones.
- **No data loss / auditability.** The raw file is stored before processing. An
  `import_jobs` record and per-row `import_row_results` are persisted (status,
  message, mapped `animal_id`), giving an audit trail and the basis for the
  report; each imported animal is tagged with its `import_job_id`.
- **Transactional per row.** Each animal plus its identifier (and optional initial
  weight) is written atomically; the unit of transaction is the row, not the file.
- **Real-world input.** A downloadable CSV template constrains the source format,
  and the parser handles what Spanish-locale Excel exports produce (BOM,
  semicolon separators, latin-1 encoding, `DD/MM/YYYY` dates).

## API Conventions

- Versioned under `/api/v1`; JSON bodies; snake_case fields (mirrors the DB).
- List endpoints paginate with `limit` / `offset` and return a total count.
- Single consistent error shape with field-level details on validation failures;
  correct HTTP status codes (422 validation, 409 conflict, 404 not found, 401
  unauthorized).
- Create endpoints accept an optional client-generated `id` (UUIDv7) and an
  optional `Idempotency-Key` header, so retried/offline creates do not duplicate.

The full contract is in `openapi.yaml`.

## Multi-tenancy

- **Decided: row-level multi-tenancy from day one.** Every tenant-owned table
  carries `organization_id`; the MVP runs with a single organization, but the
  structure already supports N, so isolation can be activated later without a
  data backfill.
- **The tenant is the organization, not the user**, because a farm has multiple
  collaborators (owner, members) sharing the same herd.
- When isolation is enforced for real, `organization_id` is denormalized onto
  child/event tables and RLS policies are enabled.

## Internationalization

- i18n infrastructure is wired from the start; adding languages later is cheap,
  retrofitting i18n is not.
- **Spanish is shipped first** (the target market), with English kept ready.
- Localization includes units (kg / lb), dates, and currency, not only strings.

## Offline (future)

Full offline is deferred, but the design hooks are present now so it can be added
without schema changes: client-generated UUIDv7 IDs, `Idempotency-Key` on writes
(server treats writes as upserts keyed by client ID), and `updated_at` for
last-write-wins conflict resolution. When implemented, the pattern is an outbox
mutation queue (IndexedDB) synced on reconnect; a PWA is the cheap web→mobile
bridge. Libraries such as PowerSync, ElectricSQL, or RxDB can provide the sync
layer.

## Deployment & Cost

Stack is cheap to host. Two realistic paths for the MVP:

- **PaaS (lowest ops):** the NestJS API on Railway or Fly.io, PostgreSQL on Neon
  or Supabase (free tier), the static frontend on Cloudflare Pages or Vercel
  (free). Roughly $0–20/month.
- **VPS:** a single Hetzner/DigitalOcean instance (~$10–20/month) running Docker
  Compose with Caddy or Traefik for TLS, plus managed or self-hosted PostgreSQL.

The Node runtime image is heavier than a Go binary would have been, but the
difference is negligible at this scale (perhaps a slightly larger instance).

## Documentation & Tooling Conventions

- All code is documented, and all documentation is written in English.
- All documentation for AI tools, agents, skills, and MCPs is written in English
  and kept **AI-agnostic** — not tied to any specific tool used to build the app.

## Artifacts

- `schema.sql` — PostgreSQL DDL (authoritative data model).
- `openapi.yaml` — API contract (MVP scope).

## References

- https://gansoft.io/ — closest reference product.
- Feature patterns also informed by reviewing AgriWebb, Herdwatch, CattleMax,
  BovControl, Farmbrite, and Breedr (offline/field use, EID tags, breeding,
  growth tracking, traceability).