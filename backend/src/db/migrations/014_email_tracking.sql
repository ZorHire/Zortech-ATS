-- Migration 014: Email analytics tracking tables

-- Per-recipient tracking (one row per campaign × recipient)
CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id  uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  tracking_id  uuid NOT NULL DEFAULT uuid_generate_v4(),
  email        text NOT NULL,
  name         text,
  status       text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','delivered','bounced','failed')),
  delivered_at  timestamptz,
  bounce_reason text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(campaign_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ecr_campaign  ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ecr_tracking  ON email_campaign_recipients(tracking_id);
CREATE INDEX IF NOT EXISTS idx_ecr_tenant    ON email_campaign_recipients(tenant_id);

-- Open / click / unsubscribe events per recipient
CREATE TABLE IF NOT EXISTS email_events (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id  uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  event_type   text NOT NULL CHECK (event_type IN ('open','click','unsubscribe')),
  metadata     jsonb,
  ip_address   text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ee_campaign  ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ee_recipient ON email_events(recipient_id);
CREATE INDEX IF NOT EXISTS idx_ee_type      ON email_events(event_type);

-- Tenant-scoped unsubscribe list
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           text NOT NULL,
  campaign_id     uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  unsubscribed_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_unsub_tenant ON email_unsubscribes(tenant_id, email);

-- Add tracking preference columns to existing campaigns table
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS track_opens  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_clicks boolean DEFAULT true;
