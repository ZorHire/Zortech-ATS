-- ── Phase 2: JD Lifecycle & Distribution ──────────────────────────────────────
-- Safe to re-run: all statements use IF NOT EXISTS guards.

-- 1. job_versions: immutable snapshot of a JD taken on each "submit for review".
--    version_num is per-job and monotonically increases.
CREATE TABLE IF NOT EXISTS job_versions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id)    ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_num  INT  NOT NULL,
  submitted_by UUID REFERENCES users(id),
  snapshot     JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jv_job ON job_versions(job_id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jv_version ON job_versions(job_id, version_num);

-- 2. job_approvals: one record per review cycle.
--    A new record is created each time a JD is submitted for review.
--    Only one 'pending' record can exist per job at a time (enforced in app layer).
CREATE TABLE IF NOT EXISTS job_approvals (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id)    ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by  UUID REFERENCES users(id),
  reviewed_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected')),
  notes        TEXT,
  version_num  INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ja_job     ON job_approvals(job_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ja_pending ON job_approvals(tenant_id, status)
  WHERE status = 'pending';
