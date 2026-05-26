-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table for tenant isolation
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  domain text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant Memberships (Linking users to tenants with specific roles)
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'recruiter' CHECK (role IN ('super_admin','accounts_manager','recruiter','vendor_manager','vendor_user')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  phone text,
  department text,
  vendor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_type text,
  industry text,
  company_size text,
  tier text NOT NULL DEFAULT 'standard' CHECK (tier IN ('priority', 'standard')),
  website text,
  linkedin text,
  logo_url text,
  headquarters_location text,
  operating_locations text[] DEFAULT '{}',
  address text,
  city text,
  country text DEFAULT 'India',
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  alternate_contact text,
  engagement_type text,
  hiring_volume integer,
  active_requirements integer DEFAULT 0,
  client_priority text,
  sla text,
  working_hours text,
  billing_model text,
  currency text DEFAULT 'INR',
  markup text,
  payment_terms text,
  invoice_cycle text,
  billing_contact text,
  contract_start date,
  contract_end date,
  msa_signed boolean DEFAULT false,
  nda_signed boolean DEFAULT false,
  preferred_skills text[] DEFAULT '{}',
  typical_roles text[] DEFAULT '{}',
  candidate_preference text,
  hiring_strategy text,
  interview_process text,
  evaluation_criteria text,
  positions_closed integer DEFAULT 0,
  avg_closure_time numeric,
  interview_ratio numeric,
  offer_acceptance_rate numeric,
  preferred_channel text,
  update_frequency text,
  auto_report boolean DEFAULT false,
  account_manager text,
  delivery_lead text,
  recruiters text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  notes text,
  sla_hours integer NOT NULL DEFAULT 48,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Client stakeholders
CREATE TABLE IF NOT EXISTS client_stakeholders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  timezone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id),
  title text NOT NULL,
  department text,
  location text,
  work_mode text NOT NULL DEFAULT 'onsite' CHECK (work_mode IN ('remote','hybrid','onsite')),
  employment_type text NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','internship')),
  experience_min integer DEFAULT 0,
  experience_max integer DEFAULT 10,
  salary_min numeric,
  salary_max numeric,
  currency text DEFAULT 'INR',
  headcount integer NOT NULL DEFAULT 1,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','active','on_hold','closed_filled','closed_cancelled','expired')),
  description text,
  mandatory_skills text[] DEFAULT '{}',
  preferred_skills text[] DEFAULT '{}',
  assigned_recruiter_id uuid REFERENCES users(id),
  assigned_vendor_id uuid,
  target_start_date date,
  sla_deadline timestamptz,
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  current_title text,
  current_company text,
  experience_years numeric DEFAULT 0,
  current_location text,
  preferred_location text,
  notice_period_days integer DEFAULT 30,
  current_ctc numeric,
  expected_ctc numeric,
  skills text[] DEFAULT '{}',
  summary text,
  resume_url text,
  source text DEFAULT 'direct' CHECK (source IN ('linkedin','indeed','naukri','monster','glassdoor','vendor','referral','direct','other')),
  gdpr_consent boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Job Applications (pipeline)
CREATE TABLE IF NOT EXISTS job_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id),
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','sourced','screened','shortlisted','submitted_to_client','client_interview_scheduled','interview_completed','selected','offer_extended','offer_accepted','offer_rejected','joined','disqualified')),
  ai_score numeric,
  ai_match_breakdown jsonb,
  rejection_reason text,
  notes text,
  assigned_to uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, job_id, candidate_id)
);

-- Pipeline events (immutable log)
CREATE TABLE IF NOT EXISTS pipeline_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES job_applications(id),
  from_stage text,
  to_stage text NOT NULL,
  changed_by uuid REFERENCES users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  registration_number text,
  gst_id text,
  primary_contact_name text NOT NULL,
  primary_contact_email text NOT NULL,
  primary_contact_phone text,
  industry_specializations text[] DEFAULT '{}',
  geographies text[] DEFAULT '{}',
  tier text NOT NULL DEFAULT 'standard' CHECK (tier IN ('preferred','standard','blocked')),
  quality_score numeric DEFAULT 0,
  submission_count integer DEFAULT 0,
  shortlist_rate numeric DEFAULT 0,
  fill_rate numeric DEFAULT 0,
  sla_adherence numeric DEFAULT 100,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Email campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  recipient_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  opened_count integer DEFAULT 0,
  clicked_count integer DEFAULT 0,
  bounced_count integer DEFAULT 0,
  unsubscribed_count integer DEFAULT 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-user SMTP email configuration (app-password stored encrypted at rest)
CREATE TABLE IF NOT EXISTS user_email_config (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email              text        NOT NULL,
  encrypted_password text        NOT NULL,
  provider           text        NOT NULL DEFAULT 'gmail',
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

-- Per-tenant (company) SMTP config — one shared mailbox per company (e.g. hiring@acme.com)
-- Used as tier-2 fallback when a recruiter has no personal SMTP configured.
-- ZorTech (is_platform_owner) uses this same table — no hardcoded env-var SMTP.
CREATE TABLE IF NOT EXISTS tenant_email_config (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email              text        NOT NULL,
  encrypted_password text        NOT NULL,
  provider           text        NOT NULL DEFAULT 'zoho',
  display_name       text,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_email_config_tenant_id ON tenant_email_config(tenant_id);

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES job_applications(id),
  interview_type text NOT NULL DEFAULT 'phone' CHECK (interview_type IN ('phone','video','face_to_face')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  interviewer_name text,
  interviewer_email text,
  meeting_link text,
  feedback_score numeric,
  feedback_notes text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant subscriptions (one active subscription per tenant)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_type               text        NOT NULL CHECK (plan_type IN ('starter', 'growth', 'enterprise')),
  status                  text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  billing_cycle           text        NOT NULL DEFAULT 'monthly'
                            CHECK (billing_cycle IN ('monthly', 'yearly')),
  razorpay_subscription_id text,
  razorpay_plan_id         text,
  start_date              timestamptz NOT NULL DEFAULT now(),
  end_date                timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

-- Payment transactions — full audit trail of every Razorpay order attempt
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  razorpay_order_id    text        NOT NULL,
  razorpay_payment_id  text,
  razorpay_signature   text,
  plan_type            text        NOT NULL CHECK (plan_type IN ('starter', 'growth', 'enterprise')),
  billing_cycle        text        NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount               integer     NOT NULL,
  currency             text        NOT NULL DEFAULT 'INR',
  status               text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
  failure_reason       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (razorpay_order_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(tenant_id, status);

-- Indexes for performance (tenant isolation, FK lookups, filter columns)
CREATE INDEX IF NOT EXISTS idx_candidates_tenant_deleted ON candidates(tenant_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON jobs(tenant_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_deleted ON clients(tenant_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate ON job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_tenant ON job_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_assigned ON job_applications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_application ON pipeline_events(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_vendor ON profiles(vendor_id);

-- ─── DB Division: Platform Owner vs Onboarding Companies ────────────────────
-- Run once on existing DB; IF NOT EXISTS / ON CONFLICT make it safe to re-run.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_platform_owner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_email     text,
  ADD COLUMN IF NOT EXISTS company_phone     text,
  ADD COLUMN IF NOT EXISTS company_address   text,
  ADD COLUMN IF NOT EXISTS gst_number        text,
  ADD COLUMN IF NOT EXISTS country           text NOT NULL DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS onboarded_by      uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS onboarded_at      timestamptz;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tenants_platform_owner      ON tenants(is_platform_owner);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status ON subscriptions(tenant_id, status);

-- Seed: primary tenant
INSERT INTO tenants (id, name, slug, is_platform_owner)
VALUES
  ('77777777-7777-7777-7777-777777777777', 'Zortech Global', 'zortech', true)
ON CONFLICT (id) DO UPDATE SET is_platform_owner = true;

-- Seed: super_admin user (joy@zortechs.in / Training5!@)
INSERT INTO users (id, email, password, must_change_password, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'joy@zortechs.in',
  '$2b$10$4B2BRFYweY1Mmnbs0JguhuBJmozz4IVdEYds0Sf5zB86sVdnwaLD2',
  false,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'joy@zortechs.in',
  'Joy (Super Admin)'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO tenant_memberships (user_id, tenant_id, role, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '77777777-7777-7777-7777-777777777777',
  'super_admin',
  true
) ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Clients
INSERT INTO clients (id, tenant_id, name, industry, tier, city, primary_contact_name, primary_contact_email, sla_hours)
VALUES
  ('11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'TechCorp India', 'Technology', 'priority', 'Bangalore', 'Priya Sharma', 'priya@techcorp.in', 24),
  ('22222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', 'FinServ Solutions', 'Finance', 'standard', 'Mumbai', 'Rahul Mehta', 'rahul@finserv.in', 48),
  ('33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777', 'HealthTech Pvt Ltd', 'Healthcare', 'priority', 'Hyderabad', 'Anita Rao', 'anita@healthtech.in', 36)
ON CONFLICT (id) DO NOTHING;

-- Job Openings (created_by is NULL — no hardcoded user dependency)
INSERT INTO jobs (id, tenant_id, client_id, title, department, location, work_mode, employment_type, experience_min, experience_max, salary_min, salary_max, headcount, priority, status, description, mandatory_skills)
VALUES
  ('11111111-1111-1111-1111-111111111112', '77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'Senior Frontend Engineer', 'Engineering', 'Bangalore', 'remote', 'full_time', 5, 10, 2500000, 4500000, 2, 'high', 'active', 'Looking for a React expert with 5+ years of experience.', ARRAY['React', 'TypeScript', 'Tailwind CSS']),
  ('22222222-2222-2222-2222-222222222223', '77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'Backend Developer (Node.js)', 'Engineering', 'Mumbai', 'hybrid', 'full_time', 3, 7, 1800000, 3500000, 3, 'medium', 'active', 'Node.js and PostgreSQL expert needed.', ARRAY['Node.js', 'PostgreSQL', 'Express']),
  ('33333333-3333-3333-3333-333333333334', '77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'Product Manager', 'Product', 'Remote', 'remote', 'full_time', 4, 8, 2000000, 4000000, 1, 'critical', 'active', 'Experienced PM for B2B SaaS.', ARRAY['Product Strategy', 'Agile', 'Jira'])
ON CONFLICT (id) DO NOTHING;

-- Candidates (created_by is NULL — no hardcoded user dependency)
INSERT INTO candidates (id, tenant_id, first_name, last_name, email, phone, current_title, current_company, experience_years, current_location, skills, source)
VALUES
  ('11111111-1111-1111-1111-111111111113', '77777777-7777-7777-7777-777777777777', 'Amit', 'Sharma', 'amit.sharma@example.com', '9876543210', 'Senior Dev', 'TCS', 6, 'Bangalore', ARRAY['React', 'Node.js'], 'linkedin'),
  ('22222222-2222-2222-2222-222222222224', '77777777-7777-7777-7777-777777777777', 'Neha', 'Gupta', 'neha.gupta@example.com', '9876543211', 'Frontend Dev', 'Infosys', 4, 'Pune', ARRAY['Vue.js', 'JavaScript'], 'indeed'),
  ('33333333-3333-3333-3333-333333333335', '77777777-7777-7777-7777-777777777777', 'Vikram', 'Singh', 'vikram.singh@example.com', '9876543212', 'PM', 'Airtel', 7, 'Delhi', ARRAY['Agile', 'Product'], 'referral')
ON CONFLICT (id) DO NOTHING;

-- Vendors
INSERT INTO vendors (id, tenant_id, company_name, primary_contact_name, primary_contact_email, tier, quality_score, submission_count, shortlist_rate, fill_rate)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'TalentBridge Staffing', 'Karan Patel', 'karan@talentbridge.in', 'preferred', 87, 142, 34, 12),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', 'HireRight Solutions', 'Deepa Nair', 'deepa@hireright.in', 'standard', 72, 89, 24, 8),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '77777777-7777-7777-7777-777777777777', 'PeopleFirst Agency', 'Suresh Kumar', 'suresh@peoplefirst.in', 'standard', 65, 56, 18, 5)
ON CONFLICT (id) DO NOTHING;
