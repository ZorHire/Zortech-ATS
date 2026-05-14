-- Migration 006: Add migration-tracking columns to tenant_db_registry
-- Run this ONLY if you applied migration 005 before these columns were added.
-- Safe to re-run (ADD COLUMN IF NOT EXISTS, idempotent constraint guard).
--
--   psql $SERVER_DATABASE_URL -f backend/src/db/migrations/006_tenant_db_registry_enhancement.sql

ALTER TABLE tenant_db_registry
  ADD COLUMN IF NOT EXISTS migrated_at      timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at      timestamptz,
  ADD COLUMN IF NOT EXISTS migration_status text,
  ADD COLUMN IF NOT EXISTS last_error       text;

-- Add CHECK constraint if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_db_registry_migration_status_check'
      AND conrelid = 'tenant_db_registry'::regclass
  ) THEN
    ALTER TABLE tenant_db_registry
      ADD CONSTRAINT tenant_db_registry_migration_status_check
      CHECK (migration_status IN ('pending','migrating','verifying','live','failed'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tenant_db_registry_mig_status ON tenant_db_registry(migration_status);
