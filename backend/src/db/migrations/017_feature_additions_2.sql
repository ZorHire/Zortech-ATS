-- 017: interview structured feedback, rejection reasons, vendor blacklist, engagement log

-- 1. Structured interview feedback dimensions + lock flag
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS feedback_ratings jsonb DEFAULT NULL;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS feedback_locked  boolean DEFAULT false;

-- 2. Rejection reason on vendor portal submissions
ALTER TABLE vendor_portal_submissions ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT NULL;

-- 3. Vendor blacklist
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_blacklisted   boolean DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS blacklist_reason text    DEFAULT NULL;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS blacklisted_at   timestamptz DEFAULT NULL;

-- 4. Candidate engagement log (emails sent, calls, notes)
CREATE TABLE IF NOT EXISTS candidate_engagement_logs (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidate_id uuid        NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  actor_id     uuid        REFERENCES users(id),
  event_type   text        NOT NULL,   -- 'email_sent', 'call_logged', 'note', 'stage_change', 'interview_scheduled'
  summary      text        NOT NULL,
  meta         jsonb       DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cel_candidate
  ON candidate_engagement_logs(candidate_id, tenant_id, created_at DESC);
