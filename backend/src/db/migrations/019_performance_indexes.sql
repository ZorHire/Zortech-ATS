-- Scheduler campaign cron: UPDATE WHERE status='scheduled' AND scheduled_at <= $1
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled
  ON email_campaigns(scheduled_at)
  WHERE status = 'scheduled';

-- dispatchScheduledCampaign: SELECT WHERE campaign_id=$1 AND status='pending'
-- Existing idx_ecr_campaign only covers campaign_id; adding status narrows it significantly
CREATE INDEX IF NOT EXISTS idx_ecr_campaign_status
  ON email_campaign_recipients(campaign_id, status);

-- Pipeline stage filtering: WHERE tenant_id=$1 AND stage=$2
CREATE INDEX IF NOT EXISTS idx_job_applications_tenant_stage
  ON job_applications(tenant_id, stage);

-- Nightly expiry cron (jobs): WHERE status='active' AND target_start_date < CURRENT_DATE
CREATE INDEX IF NOT EXISTS idx_jobs_status_target_start
  ON jobs(status, target_start_date)
  WHERE status = 'active' AND target_start_date IS NOT NULL;

-- Nightly expiry cron (vendor_contracts): WHERE status='active' AND end_date < CURRENT_DATE
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_status_end_date
  ON vendor_contracts(status, end_date)
  WHERE status = 'active' AND end_date IS NOT NULL;

-- Screening sessions status filter: WHERE id=$1 AND status='active'
CREATE INDEX IF NOT EXISTS idx_screening_sessions_status
  ON screening_sessions(status)
  WHERE status = 'active';

-- Notification auto-cleanup: delete old read notifications by created_at
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(created_at);
