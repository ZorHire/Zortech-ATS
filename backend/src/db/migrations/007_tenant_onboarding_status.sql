-- 007_tenant_onboarding_status.sql
-- Tracks the 6-step onboarding checklist per onboarding company.
-- Row is created atomically with the tenant in bootstrapTenant().
-- account_created is always true (the row only exists after account creation).

CREATE TABLE IF NOT EXISTS tenant_onboarding_status (
  tenant_id         uuid        PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  account_created   boolean     NOT NULL DEFAULT true,
  profile_complete  boolean     NOT NULL DEFAULT false,
  team_invited      boolean     NOT NULL DEFAULT false,
  pipeline_created  boolean     NOT NULL DEFAULT false,
  channel_connected boolean     NOT NULL DEFAULT false,
  first_job_posted  boolean     NOT NULL DEFAULT false,
  welcome_email_sent boolean    NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_tenant ON tenant_onboarding_status(tenant_id);
