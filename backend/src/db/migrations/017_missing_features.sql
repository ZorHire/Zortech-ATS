-- 017: Missing Features Migration
-- JD Versioning
CREATE TABLE IF NOT EXISTS job_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  changed_by UUID,
  change_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_versions_job_id ON job_versions(job_id, tenant_id);

-- JD Approval Workflow
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approval_notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ;

-- Vendor Compliance Documents
CREATE TABLE IF NOT EXISTS vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  expiry_date DATE,
  status TEXT DEFAULT 'active',
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_docs_vendor ON vendor_documents(vendor_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_docs_expiry ON vendor_documents(expiry_date) WHERE status = 'active';

-- GDPR on candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS gdpr_consent BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS gdpr_consent_date TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

-- Email campaign scheduling + test
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS test_email TEXT;

-- Search history
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  query_text TEXT NOT NULL,
  filters JSONB,
  result_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, tenant_id);

-- Report preferences per tenant
CREATE TABLE IF NOT EXISTS report_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  daily_digest_enabled BOOLEAN DEFAULT true,
  weekly_summary_enabled BOOLEAN DEFAULT true,
  monthly_report_enabled BOOLEAN DEFAULT true,
  digest_recipients TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
