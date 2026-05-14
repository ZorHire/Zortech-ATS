-- Add multi-assignment array columns to jobs table.
-- Existing single-value columns are kept for backward compatibility with
-- candidates/pipeline controllers that still reference them.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS assigned_recruiter_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_vendor_ids    uuid[] DEFAULT '{}';

-- Migrate existing single-assignment data into the new array columns.
UPDATE jobs
SET assigned_recruiter_ids = ARRAY[assigned_recruiter_id]
WHERE assigned_recruiter_id IS NOT NULL
  AND (assigned_recruiter_ids IS NULL OR assigned_recruiter_ids = '{}');

UPDATE jobs
SET assigned_vendor_ids = ARRAY[assigned_vendor_id]
WHERE assigned_vendor_id IS NOT NULL
  AND (assigned_vendor_ids IS NULL OR assigned_vendor_ids = '{}');
