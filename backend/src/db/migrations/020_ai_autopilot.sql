-- AI recruiting agents (autopilot). See docs/ai-agents.md.
-- Additive only: new tables + nullable columns.

-- Per-job autopilot settings
CREATE TABLE IF NOT EXISTS job_autopilot (
  job_id                 uuid        PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  tenant_id              uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled                boolean     NOT NULL DEFAULT false,
  shortlist_threshold    int         NOT NULL DEFAULT 70 CHECK (shortlist_threshold BETWEEN 0 AND 100),
  screen_pass_threshold  int         NOT NULL DEFAULT 65 CHECK (screen_pass_threshold BETWEEN 0 AND 100),
  auto_screen            boolean     NOT NULL DEFAULT true,
  auto_schedule          boolean     NOT NULL DEFAULT true,
  interview_duration_min int         NOT NULL DEFAULT 45 CHECK (interview_duration_min BETWEEN 15 AND 240),
  interview_slots        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  daily_outreach_cap     int         NOT NULL DEFAULT 25 CHECK (daily_outreach_cap BETWEEN 0 AND 1000),
  updated_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_autopilot_tenant_enabled ON job_autopilot(tenant_id) WHERE enabled;

-- Durable work queue for agents (processed by scheduler.ts every minute)
CREATE TABLE IF NOT EXISTS agent_tasks (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id         uuid        REFERENCES jobs(id) ON DELETE CASCADE,
  application_id uuid        NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  agent          text        NOT NULL CHECK (agent IN ('shortlister','screener','screen_evaluator','scheduler')),
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','skipped')),
  attempts       int         NOT NULL DEFAULT 0,
  run_after      timestamptz NOT NULL DEFAULT now(),
  manual         boolean     NOT NULL DEFAULT false,
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
-- At most one open task per application + agent
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_tasks_open
  ON agent_tasks(application_id, agent) WHERE status IN ('pending','running');
CREATE INDEX IF NOT EXISTS idx_agent_tasks_due ON agent_tasks(status, run_after);

-- Activity feed
CREATE TABLE IF NOT EXISTS agent_events (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id         uuid        REFERENCES jobs(id) ON DELETE SET NULL,
  application_id uuid        REFERENCES job_applications(id) ON DELETE SET NULL,
  agent          text        NOT NULL,
  action         text        NOT NULL,
  summary        text        NOT NULL,
  detail         jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_events_tenant_time ON agent_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_application ON agent_events(application_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_job_action_time ON agent_events(job_id, action, created_at);

-- Shortlister output + review flag on applications
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS ai_shortlist jsonb;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- Structured evaluation of a finished screening chat
ALTER TABLE screening_sessions ADD COLUMN IF NOT EXISTS evaluation jsonb;
ALTER TABLE screening_sessions ADD COLUMN IF NOT EXISTS invited_by_agent boolean NOT NULL DEFAULT false;

-- Candidate self-scheduling links
CREATE TABLE IF NOT EXISTS interview_bookings (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid        NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  token_hash     text        NOT NULL UNIQUE,
  slots          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  duration_min   int         NOT NULL DEFAULT 45,
  status         text        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','booked','expired','cancelled')),
  chosen_slot    timestamptz,
  interview_id   uuid        REFERENCES interviews(id) ON DELETE SET NULL,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interview_bookings_application ON interview_bookings(application_id);
