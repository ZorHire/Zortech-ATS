-- Migration 003: store resume binary in DB instead of ephemeral disk
-- Run once against NeonDB. Idempotent — IF NOT EXISTS guards.

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS resume_data      BYTEA,
  ADD COLUMN IF NOT EXISTS resume_mime_type VARCHAR(100);
