-- Migration 018: External integrations tables

-- OAuth tokens (Google Calendar, Outlook, LinkedIn)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  user_id       UUID,
  provider      TEXT NOT NULL,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, provider),
  UNIQUE (tenant_id, provider)
);

-- SMS / WhatsApp send logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  to_number   TEXT NOT NULL,
  message     TEXT NOT NULL,
  provider    TEXT NOT NULL DEFAULT 'twilio',
  external_id TEXT,
  status      TEXT NOT NULL DEFAULT 'sent',
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_tenant ON sms_logs (tenant_id, sent_at DESC);

-- Email bounce tracking (SendGrid)
CREATE TABLE IF NOT EXISTS email_bounces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  email       TEXT NOT NULL,
  reason      TEXT,
  bounced_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

-- Email unsubscribes (SendGrid)
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  email             TEXT NOT NULL,
  unsubscribed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

-- Extend campaign_recipients with engagement columns (only if the table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_recipients') THEN
    ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;
    ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS opened_at     TIMESTAMPTZ;
    ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS open_count    INT DEFAULT 0;
    ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS clicked_at    TIMESTAMPTZ;
    ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS click_count   INT DEFAULT 0;
  END IF;
END $$;

-- Calendly self-scheduling links
CREATE TABLE IF NOT EXISTS scheduling_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  interview_id          UUID,
  candidate_email       TEXT,
  calendly_link_uri     TEXT,
  booking_url           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  invitation_sent_at    TIMESTAMPTZ,
  booked_at             TIMESTAMPTZ,
  invitee_email         TEXT,
  invitee_name          TEXT,
  calendly_event_uri    TEXT,
  scheduled_start       TIMESTAMPTZ,
  scheduled_end         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduling_links_tenant ON scheduling_links (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_links_interview ON scheduling_links (interview_id);

-- Add calendly_event_uri to interviews (if not present)
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS calendar_event_id   TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS calendar_provider   TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS calendly_event_uri  TEXT;

-- Job board postings (LinkedIn, Naukri, Indeed)
CREATE TABLE IF NOT EXISTS job_board_postings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  job_id          UUID NOT NULL,
  board_name      TEXT NOT NULL,
  external_job_id TEXT,
  posted_at       TIMESTAMPTZ DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active',
  UNIQUE (tenant_id, job_id, board_name)
);

CREATE INDEX IF NOT EXISTS idx_job_board_postings_tenant_job ON job_board_postings (tenant_id, job_id);
