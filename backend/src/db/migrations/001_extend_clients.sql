-- Migration 001: Extend clients table + add client_stakeholders
-- Run once against your Neon DB:
--   psql $DATABASE_URL -f backend/src/db/migrations/001_extend_clients.sql

-- ─── Extend clients table ───────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS client_type          text CHECK (client_type IN ('Direct','Implementation Partner','Vendor')),
  ADD COLUMN IF NOT EXISTS company_size         text,
  ADD COLUMN IF NOT EXISTS linkedin             text,
  ADD COLUMN IF NOT EXISTS headquarters_location text,
  ADD COLUMN IF NOT EXISTS operating_locations  text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alternate_contact    text,
  ADD COLUMN IF NOT EXISTS engagement_type      text CHECK (engagement_type IN ('Contract','Full-Time','C2H')),
  ADD COLUMN IF NOT EXISTS hiring_volume        integer,
  ADD COLUMN IF NOT EXISTS active_requirements  integer  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_priority      text CHECK (client_priority IN ('High','Medium','Low')),
  ADD COLUMN IF NOT EXISTS sla                  text,
  ADD COLUMN IF NOT EXISTS working_hours        text,
  ADD COLUMN IF NOT EXISTS billing_model        text,
  ADD COLUMN IF NOT EXISTS currency             text     DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS markup               text,
  ADD COLUMN IF NOT EXISTS payment_terms        text,
  ADD COLUMN IF NOT EXISTS invoice_cycle        text,
  ADD COLUMN IF NOT EXISTS billing_contact      text,
  ADD COLUMN IF NOT EXISTS contract_start       date,
  ADD COLUMN IF NOT EXISTS contract_end         date,
  ADD COLUMN IF NOT EXISTS msa_signed           boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS nda_signed           boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_skills     text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS typical_roles        text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS candidate_preference text,
  ADD COLUMN IF NOT EXISTS hiring_strategy      text,
  ADD COLUMN IF NOT EXISTS interview_process    text,
  ADD COLUMN IF NOT EXISTS evaluation_criteria  text,
  ADD COLUMN IF NOT EXISTS positions_closed     integer  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_closure_time     numeric,
  ADD COLUMN IF NOT EXISTS interview_ratio      numeric,
  ADD COLUMN IF NOT EXISTS offer_acceptance_rate numeric,
  ADD COLUMN IF NOT EXISTS preferred_channel    text,
  ADD COLUMN IF NOT EXISTS update_frequency     text,
  ADD COLUMN IF NOT EXISTS auto_report          boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_manager      text,
  ADD COLUMN IF NOT EXISTS delivery_lead        text,
  ADD COLUMN IF NOT EXISTS recruiters           text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags                 text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes                text;

-- ─── Client Stakeholders table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_stakeholders (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id  uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  role       text,
  email      text,
  phone      text,
  timezone   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_stakeholders_client_id ON client_stakeholders(client_id);
CREATE INDEX IF NOT EXISTS idx_client_stakeholders_tenant_id ON client_stakeholders(tenant_id);
