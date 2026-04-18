-- Migration 002: Ensure user_email_config table exists
-- Run once against your Neon DB:
--   psql $DATABASE_URL -f backend/src/db/migrations/002_ensure_user_email_config.sql

CREATE TABLE IF NOT EXISTS user_email_config (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email              text        NOT NULL,
  encrypted_password text        NOT NULL,
  provider           text        NOT NULL DEFAULT 'zoho',
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_email_config_user_id   ON user_email_config(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email_config_tenant_id ON user_email_config(tenant_id);
