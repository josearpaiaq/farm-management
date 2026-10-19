-- ============================================================================
-- Farm Management — authoritative PostgreSQL schema (MVP)
-- ============================================================================
-- Conventions (see project-plan.md):
--   * UUID primary keys. Clients SHOULD generate UUIDv7 for offline support
--     and sortability; gen_random_uuid() is the server-side fallback.
--   * Row-level multi-tenancy: tenant-owned tables carry organization_id.
--     Child/event tables scope through their parent (animal/farm); the
--     organization_id is denormalized onto them only when RLS is enforced.
--   * Controlled vocabularies are text codes guarded by CHECK constraints;
--     human-readable labels live in frontend i18n.
--   * No hard deletes: animal lifecycle is driven by `status`; `deleted_at`
--     is reserved for records created in error.
--   * `updated_at` is maintained by trigger (basis for offline conflict
--     resolution later).
--   * Applied automatically on first boot of the dev database (mounted in
--     /docker-entrypoint-initdb.d). Prisma bootstraps from it via `db pull`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tenancy & auth
-- ----------------------------------------------------------------------------

CREATE TABLE organizations (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Isolated role catalog (not an enum on users) so fine-grained permissions
-- can be added later (permissions / role_permissions) without touching users.
CREATE TABLE roles (
    id   smallint PRIMARY KEY,
    name text     NOT NULL UNIQUE
);

INSERT INTO roles (id, name) VALUES (1, 'owner'), (2, 'member');

CREATE TABLE users (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations (id),
    role_id         smallint    NOT NULL REFERENCES roles (id),
    email           text        NOT NULL,
    password_hash   text        NOT NULL,
    full_name       text        NOT NULL,
    -- NULL until the user proves ownership of the email with a code.
    email_verified_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE INDEX users_organization_id_idx ON users (organization_id);

-- One-time codes sent by email (verification, passwordless login, password
-- reset). Only an HMAC of the code is stored; codes are short-lived and
-- lock after a few wrong attempts.
CREATE TABLE email_codes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose     text        NOT NULL CHECK (purpose IN ('verify_email', 'login', 'reset_password')),
    code_hash   text        NOT NULL,
    attempts    smallint    NOT NULL DEFAULT 0,
    expires_at  timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_codes_user_purpose_idx ON email_codes (user_id, purpose);

-- Server-side session store (connect-pg-simple layout).
CREATE TABLE sessions (
    sid    text         PRIMARY KEY,
    sess   json         NOT NULL,
    expire timestamp(6) NOT NULL
);

CREATE INDEX sessions_expire_idx ON sessions (expire);

-- ----------------------------------------------------------------------------
-- Farms & catalogs
-- ----------------------------------------------------------------------------

CREATE TABLE farms (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations (id),
    name            text        NOT NULL,
    location        text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX farms_organization_id_idx ON farms (organization_id);

-- Per-organization breed catalog, scoped to a species.
CREATE TABLE breeds (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations (id),
    species         text        NOT NULL CHECK (species IN ('cattle', 'sheep', 'goat', 'pig', 'horse', 'other')),
    name            text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    UNIQUE (organization_id, species, name)
);

-- ----------------------------------------------------------------------------
-- CSV import audit trail
-- (declared before animals: animals.import_job_id references import_jobs)
-- ----------------------------------------------------------------------------

CREATE TABLE import_jobs (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations (id),
    created_by      uuid        REFERENCES users (id),
    filename        text        NOT NULL,
    -- Raw uploaded file, stored before any processing (no data loss).
    raw_file        bytea       NOT NULL,
    dry_run         boolean     NOT NULL,
    status          text        NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    total_rows      integer,
    ok_rows         integer,
    error_rows      integer,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_jobs_organization_id_idx ON import_jobs (organization_id);

-- ----------------------------------------------------------------------------
-- Animals
-- ----------------------------------------------------------------------------

-- Core entity: only slow-changing attributes. Everything that changes over
-- time (weight, health, breeding, movements, production) is an append-only
-- event row in the tables below. Age derives from birth_date.
CREATE TABLE animals (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations (id),
    farm_id         uuid        NOT NULL REFERENCES farms (id),
    species         text        NOT NULL CHECK (species IN ('cattle', 'sheep', 'goat', 'pig', 'horse', 'other')),
    sex             text        NOT NULL CHECK (sex IN ('male', 'female')),
    breed_id        uuid        REFERENCES breeds (id),
    birth_date      date,
    tenure          text        NOT NULL DEFAULT 'owned' CHECK (tenure IN ('owned', 'leased')),
    -- Lifecycle: animals are never hard-deleted, their status changes.
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'dead', 'culled', 'transferred')),
    -- Genealogy, captured from day one (cannot be reconstructed later).
    sire_id         uuid        REFERENCES animals (id),
    dam_id          uuid        REFERENCES animals (id),
    import_job_id   uuid        REFERENCES import_jobs (id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX animals_organization_id_status_idx ON animals (organization_id, status);
CREATE INDEX animals_farm_id_idx ON animals (farm_id);
CREATE INDEX animals_breed_id_idx ON animals (breed_id);
CREATE INDEX animals_sire_id_idx ON animals (sire_id);
CREATE INDEX animals_dam_id_idx ON animals (dam_id);
CREATE INDEX animals_import_job_id_idx ON animals (import_job_id);

-- Multiple identifiers per animal; tags are mutable, the UUID is identity.
CREATE TABLE animal_identifiers (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL REFERENCES organizations (id),
    animal_id       uuid        NOT NULL REFERENCES animals (id),
    id_type         text        NOT NULL CHECK (id_type IN ('tag', 'eid', 'tattoo', 'brand', 'registration')),
    value           text        NOT NULL,
    is_primary      boolean     NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX animal_identifiers_animal_id_idx ON animal_identifiers (animal_id);
-- Natural key inside an organization (CSV import upserts on it).
CREATE UNIQUE INDEX animal_identifiers_org_type_value_unique
    ON animal_identifiers (organization_id, id_type, value)
    WHERE deleted_at IS NULL;
-- At most one primary identifier per animal. is_primary is constant (true)
-- inside the predicate, so uniqueness is effectively on animal_id; it is
-- included in the index so Prisma introspects the animal→identifiers
-- relation as one-to-many instead of one-to-one.
CREATE UNIQUE INDEX animal_identifiers_one_primary_per_animal
    ON animal_identifiers (animal_id, is_primary)
    WHERE is_primary AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- Event-sourced records (append-only; deleted_at only for entry errors)
-- ----------------------------------------------------------------------------

-- Time-series weights: growth curves and average daily gain.
CREATE TABLE weight_records (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id   uuid          NOT NULL REFERENCES animals (id),
    weight_kg   numeric(7, 2) NOT NULL CHECK (weight_kg > 0),
    recorded_on date          NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    deleted_at  timestamptz
);

CREATE INDEX weight_records_animal_id_recorded_on_idx ON weight_records (animal_id, recorded_on);

CREATE TABLE health_events (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id        uuid        NOT NULL REFERENCES animals (id),
    event_type       text        NOT NULL CHECK (event_type IN ('vaccination', 'treatment', 'deworming', 'illness', 'checkup', 'other')),
    occurred_on      date        NOT NULL,
    product          text,
    description      text,
    -- Date before which the animal (or its milk) must not be sold.
    withdrawal_until date,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    deleted_at       timestamptz
);

CREATE INDEX health_events_animal_id_occurred_on_idx ON health_events (animal_id, occurred_on);

-- Reproductive cycle events, recorded against the dam.
CREATE TABLE breeding_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id   uuid        NOT NULL REFERENCES animals (id),
    event_type  text        NOT NULL CHECK (event_type IN ('heat', 'service', 'pregnancy_check', 'calving', 'abortion', 'weaning')),
    occurred_on date        NOT NULL,
    -- Sire involved in a service event, when known.
    sire_id     uuid        REFERENCES animals (id),
    details     text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz
);

CREATE INDEX breeding_events_animal_id_occurred_on_idx ON breeding_events (animal_id, occurred_on);

-- Animal movements between farms (traceability). NULL from/to represent
-- entry into / exit from the tracked farms.
CREATE TABLE movements (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id    uuid        NOT NULL REFERENCES animals (id),
    from_farm_id uuid        REFERENCES farms (id),
    to_farm_id   uuid        REFERENCES farms (id),
    moved_on     date        NOT NULL,
    reason       text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    deleted_at   timestamptz,
    CHECK (from_farm_id IS NOT NULL OR to_farm_id IS NOT NULL),
    CHECK (from_farm_id IS DISTINCT FROM to_farm_id)
);

CREATE INDEX movements_animal_id_idx ON movements (animal_id);
CREATE INDEX movements_from_farm_id_idx ON movements (from_farm_id);
CREATE INDEX movements_to_farm_id_idx ON movements (to_farm_id);

-- Milk production. Farm-level totals today; animal_id is nullable so
-- per-animal measurement can be added later with no schema change.
CREATE TABLE production_records (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id     uuid          NOT NULL REFERENCES farms (id),
    animal_id   uuid          REFERENCES animals (id),
    milk_liters numeric(8, 2) NOT NULL CHECK (milk_liters > 0),
    recorded_on date          NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    deleted_at  timestamptz
);

CREATE INDEX production_records_farm_id_recorded_on_idx ON production_records (farm_id, recorded_on);
CREATE INDEX production_records_animal_id_idx ON production_records (animal_id) WHERE animal_id IS NOT NULL;

CREATE TABLE notes (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id  uuid        NOT NULL REFERENCES animals (id),
    body       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX notes_animal_id_idx ON notes (animal_id);

-- Per-row import report: status + message per CSV row, and the animal each
-- valid row mapped to. Basis for the downloadable error report.
CREATE TABLE import_row_results (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id uuid        NOT NULL REFERENCES import_jobs (id),
    row_number    integer     NOT NULL,
    -- 'valid' / 'invalid' for dry runs; 'imported' / 'skipped' / 'error' for commits.
    status        text        NOT NULL CHECK (status IN ('valid', 'invalid', 'imported', 'skipped', 'error')),
    message       text,
    animal_id     uuid        REFERENCES animals (id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (import_job_id, row_number)
);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_set_updated_at      BEFORE UPDATE ON organizations      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_set_updated_at              BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER farms_set_updated_at              BEFORE UPDATE ON farms              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER breeds_set_updated_at             BEFORE UPDATE ON breeds             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER import_jobs_set_updated_at        BEFORE UPDATE ON import_jobs        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER animals_set_updated_at            BEFORE UPDATE ON animals            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER animal_identifiers_set_updated_at BEFORE UPDATE ON animal_identifiers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER weight_records_set_updated_at     BEFORE UPDATE ON weight_records     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER health_events_set_updated_at      BEFORE UPDATE ON health_events      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER breeding_events_set_updated_at    BEFORE UPDATE ON breeding_events    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER movements_set_updated_at          BEFORE UPDATE ON movements          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER production_records_set_updated_at BEFORE UPDATE ON production_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notes_set_updated_at              BEFORE UPDATE ON notes              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
