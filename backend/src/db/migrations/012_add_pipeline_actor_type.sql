-- Migration 012: distinguishes AI-initiated pipeline stage moves (A4 auto-shortlisting)
-- from human-initiated ones. Nullable with a default so existing rows and future
-- human INSERTs (which don't set this column) are correctly classified without backfill.
ALTER TABLE pipeline_events ADD COLUMN IF NOT EXISTS actor_type text
  CHECK (actor_type IN ('human','ai')) DEFAULT 'human';
