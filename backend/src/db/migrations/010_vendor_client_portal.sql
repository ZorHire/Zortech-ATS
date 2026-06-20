-- ── Phase 1: Vendor Self-Service Portal + Client Portal ──────────────────────
-- Safe to re-run: all statements use IF NOT EXISTS / IF EXISTS guards.

-- 1. Extend role constraint to include client_user
--    Drop old constraint by its standard name (Migration 009 set it), add new one.
ALTER TABLE tenant_memberships DROP CONSTRAINT IF EXISTS tenant_memberships_role_check;
ALTER TABLE tenant_memberships
  ADD CONSTRAINT tenant_memberships_role_check
  CHECK (role IN ('super_admin','accounts_manager','recruiter','vendor_manager','vendor_user','client_user'));

-- 2. vendor_portal_submissions — tracks what each vendor user submitted via the portal.
--    On submission the backend also creates a real candidate + job_application so the
--    recruiter sees the candidate in their pipeline immediately.
CREATE TABLE IF NOT EXISTS vendor_portal_submissions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  vendor_id            UUID NOT NULL REFERENCES vendors(id)   ON DELETE CASCADE,
  job_id               UUID NOT NULL REFERENCES jobs(id)      ON DELETE CASCADE,
  submitted_by         UUID NOT NULL REFERENCES users(id),
  application_id       UUID REFERENCES job_applications(id),   -- populated after pipeline entry
  candidate_full_name  TEXT NOT NULL,
  candidate_email      TEXT NOT NULL,
  candidate_phone      TEXT,
  experience_years     NUMERIC,
  skills               TEXT[] DEFAULT '{}',
  cover_note           TEXT,
  status               TEXT NOT NULL DEFAULT 'submitted'
                         CHECK (status IN ('submitted','under_review','shortlisted','rejected','withdrawn')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vps_vendor   ON vendor_portal_submissions(vendor_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_vps_job      ON vendor_portal_submissions(job_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_vps_submitter ON vendor_portal_submissions(submitted_by);

-- 3. client_users — links a client_user account to one client company per tenant.
--    One user can belong to only one client per tenant (UNIQUE constraint).
CREATE TABLE IF NOT EXISTS client_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_client_users_client ON client_users(client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_users_user   ON client_users(user_id);

-- 4. client_job_access — controls which JDs are visible to a client in their portal.
CREATE TABLE IF NOT EXISTS client_job_access (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES jobs(id)     ON DELETE CASCADE,
  granted_by  UUID REFERENCES users(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_cja_client ON client_job_access(client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_cja_job    ON client_job_access(job_id, tenant_id);

-- 5. client_feedback — approve / reject / hold decision on a candidate by a client.
CREATE TABLE IF NOT EXISTS client_feedback (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id)         ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id)          ON DELETE CASCADE,
  decision       TEXT NOT NULL CHECK (decision IN ('approved','rejected','hold')),
  notes          TEXT,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(application_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_cf_application ON client_feedback(application_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_client       ON client_feedback(client_id, tenant_id);
