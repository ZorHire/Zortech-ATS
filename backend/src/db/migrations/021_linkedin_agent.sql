-- LinkedIn agent (docs/linkedin-agent.md).
-- Recruiters run the ZorHire Chrome extension inside their own signed-in LinkedIn
-- session; ZorHire never sees or stores LinkedIn passwords. The extension authenticates
-- to ZorHire with a per-user connection token (stored here only as a SHA-256 hash).

CREATE TABLE IF NOT EXISTS linkedin_ext_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  user_id       UUID NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_li_tokens_user ON linkedin_ext_tokens (tenant_id, user_id);

-- The LinkedIn account the extension last saw for a ZorHire user.
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  tenant_id               UUID NOT NULL,
  user_id                 UUID NOT NULL,
  li_name                 TEXT,
  li_public_id            TEXT,
  li_headline             TEXT,
  has_premium             BOOLEAN NOT NULL DEFAULT false,
  recruiter_lite_detected BOOLEAN NOT NULL DEFAULT false,
  -- NULL = trust detection; true/false = the user's explicit choice in ZorHire.
  recruiter_lite_override BOOLEAN,
  ext_version             TEXT,
  paused_reason           TEXT,
  paused_until            TIMESTAMPTZ,
  last_seen_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS linkedin_campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  owner_user_id       UUID NOT NULL,
  job_id              UUID,
  name                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  channel             TEXT NOT NULL DEFAULT 'linkedin' CHECK (channel IN ('linkedin','recruiter_lite')),
  -- Standard LinkedIn people-search filters + resolved LinkedIn ids (see linkedinSearch.ts).
  search              JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Recruiter Lite: boolean string + filter checklist for the Recruiter search UI.
  recruiter_search    JSONB,
  note_instructions   TEXT,
  use_notes           BOOLEAN NOT NULL DEFAULT true,
  daily_invite_limit  INT NOT NULL DEFAULT 15 CHECK (daily_invite_limit BETWEEN 1 AND 40),
  auto_send           BOOLEAN NOT NULL DEFAULT false,
  min_score           INT NOT NULL DEFAULT 60 CHECK (min_score BETWEEN 0 AND 100),
  max_pages           INT NOT NULL DEFAULT 3 CHECK (max_pages BETWEEN 1 AND 10),
  search_requested_at TIMESTAMPTZ,
  last_search_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_li_campaigns_tenant ON linkedin_campaigns (tenant_id, status);

CREATE TABLE IF NOT EXISTS linkedin_prospects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  campaign_id      UUID NOT NULL REFERENCES linkedin_campaigns(id) ON DELETE CASCADE,
  -- Dedupe key: LinkedIn vanity name (public id) or "recruiter:<id>" for Recruiter Lite results.
  profile_key      TEXT NOT NULL,
  public_id        TEXT,
  profile_url      TEXT,
  recruiter_url    TEXT,
  full_name        TEXT,
  headline         TEXT,
  location         TEXT,
  degree           TEXT,
  snippet          TEXT,
  match_score      INT,
  match_reasons    JSONB,
  note             TEXT,
  inmail_subject   TEXT,
  note_edited      BOOLEAN NOT NULL DEFAULT false,
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN
                     ('new','scored','approved','queued','sent','accepted','skipped','failed','needs_email','already_connected')),
  error            TEXT,
  lease_until      TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  candidate_id     UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, profile_key)
);
CREATE INDEX IF NOT EXISTS idx_li_prospects_campaign ON linkedin_prospects (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_li_prospects_public ON linkedin_prospects (tenant_id, public_id) WHERE public_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS linkedin_actions (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    UUID NOT NULL,
  user_id      UUID NOT NULL,
  campaign_id  UUID,
  prospect_id  UUID,
  kind         TEXT NOT NULL,
  detail       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_li_actions_user_time ON linkedin_actions (tenant_id, user_id, created_at DESC);

-- Candidates created from accepted LinkedIn prospects keep their profile link.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
