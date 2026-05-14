-- Migration 004: Per-tenant SMTP config (tier-2 email fallback)
-- Run once against your Neon DB:
--   psql $DATABASE_URL -f backend/src/db/migrations/004_add_tenant_email_config.sql

CREATE TABLE IF NOT EXISTS tenant_email_config (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email              text        NOT NULL,
  encrypted_password text        NOT NULL,
  provider           text        NOT NULL DEFAULT 'zoho',
  display_name       text,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_email_config_tenant_id ON tenant_email_config(tenant_id);
