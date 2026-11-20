-- Assisted posting to free job boards through the ZorHire Chrome extension
-- (docs/linkedin-agent.md, "Free job boards"). The extension opens the board's post-a-job
-- page in the recruiter's own browser and fills the form; the recruiter signs in (or signs
-- up) on the board themselves and clicks the board's final Post button.
CREATE TABLE IF NOT EXISTS job_board_assisted_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  board_key     TEXT NOT NULL,
  requested_by  UUID NOT NULL,
  status        TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested','opened','posted','skipped','failed')),
  posting_url   TEXT,
  error         TEXT,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at     TIMESTAMPTZ,
  posted_at     TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, job_id, board_key)
);
CREATE INDEX IF NOT EXISTS idx_jb_assist_user ON job_board_assisted_posts (tenant_id, requested_by, status);
