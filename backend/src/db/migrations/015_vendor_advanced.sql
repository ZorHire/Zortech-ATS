-- Phase 4: Advanced Vendor Features
-- Creates vendor_contracts table and adds recruiter feedback columns to vendor_portal_submissions

CREATE TABLE IF NOT EXISTS vendor_contracts (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id             uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  contract_type         text NOT NULL DEFAULT 'msa'
                          CHECK (contract_type IN ('msa','nda','sow','other')),
  title                 text NOT NULL,
  start_date            date NOT NULL,
  end_date              date,
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','expired','terminated','draft')),
  terms                 text,
  value                 numeric(14,2),
  currency              text DEFAULT 'INR',
  renewal_reminder_days int  DEFAULT 30,
  notes                 text,
  created_by            uuid REFERENCES users(id),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_contracts_vendor
  ON vendor_contracts(vendor_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_vendor_contracts_status
  ON vendor_contracts(tenant_id, status);

-- Recruiter feedback on individual vendor submissions
ALTER TABLE vendor_portal_submissions
  ADD COLUMN IF NOT EXISTS recruiter_rating   int CHECK (recruiter_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS recruiter_notes    text,
  ADD COLUMN IF NOT EXISTS feedback_given_by  uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS feedback_given_at  timestamptz;
