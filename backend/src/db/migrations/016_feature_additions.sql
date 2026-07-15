-- 016: vendor submission limits, saved searches, invoices

-- 1. Per-vendor submission limit cap on jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vendor_submission_limit int DEFAULT NULL;

-- 2. Saved candidate searches (per user, per tenant)
CREATE TABLE IF NOT EXISTS saved_searches (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  name         text        NOT NULL,
  query        jsonb       NOT NULL DEFAULT '{}',
  email_alerts boolean     DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user
  ON saved_searches(user_id, tenant_id);

-- 3. Placement invoices (auto-drafted when candidate stage reaches 'joined')
CREATE TABLE IF NOT EXISTS invoices (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id)         ON DELETE CASCADE,
  client_id      uuid        REFERENCES clients(id),
  job_id         uuid        REFERENCES jobs(id),
  application_id uuid        REFERENCES job_applications(id),
  candidate_id   uuid        REFERENCES candidates(id),
  invoice_number text        NOT NULL,
  amount         numeric(14,2),
  currency       text        DEFAULT 'INR',
  status         text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','sent','paid','cancelled')),
  due_date       date,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant
  ON invoices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_client
  ON invoices(client_id, tenant_id);
