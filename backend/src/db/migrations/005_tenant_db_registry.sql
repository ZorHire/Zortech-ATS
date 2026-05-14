-- Migration 005: Tenant DB registry for database-per-tenant architecture
-- Run once against your Neon platform DB:
--   psql $SERVER_DATABASE_URL -f backend/src/db/migrations/005_tenant_db_registry.sql
--
-- This table tracks which PostgreSQL database each tenant's ATS data lives in.
-- Connection credentials are NOT stored here — they are derived at runtime from
-- the NEON_BASE_URL environment variable plus the db_name column.
-- Safe to re-run (IF NOT EXISTS / idempotent guards throughout).

CREATE TABLE IF NOT EXISTS tenant_db_registry (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  db_name          text        NOT NULL,
  is_provisioned   boolean     NOT NULL DEFAULT false,
  schema_version   integer     NOT NULL DEFAULT 1,
  provisioned_at   timestamptz,
  last_migrated_at timestamptz,
  -- Migration tracking (added per spec §2 recommendations)
  migrated_at      timestamptz,
  verified_at      timestamptz,
  migration_status text        CHECK (migration_status IN ('pending','migrating','verifying','live','failed')),
  last_error       text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id),
  UNIQUE (db_name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_db_registry_tenant     ON tenant_db_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_db_registry_db_name    ON tenant_db_registry(db_name);
CREATE INDEX IF NOT EXISTS idx_tenant_db_registry_status     ON tenant_db_registry(is_provisioned);
CREATE INDEX IF NOT EXISTS idx_tenant_db_registry_mig_status ON tenant_db_registry(migration_status);
