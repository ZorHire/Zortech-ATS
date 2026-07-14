-- ─── Tenant Database Schema Template ────────────────────────────────────────
-- Applied to every newly provisioned tenant database by TenantProvisioningService.
--
-- WHAT IS HERE: all ATS operational tables (candidates, jobs, clients, etc.)
-- WHAT IS NOT HERE: tenants, subscriptions, tenant_memberships, users, profiles,
--   user_email_config, tenant_email_config — those remain in the PLATFORM DB.
--
-- tenant_id columns are retained in every table for two reasons:
--   1. Backward compatibility — existing controllers filter by tenant_id and
--      continue to work against the tenant DB unchanged.
--   2. Cross-shard analytics — if a future aggregation layer queries multiple
--      tenant DBs, tenant_id disambiguates rows in result sets.
--
-- Foreign keys to users (created_by, assigned_recruiter_id, changed_by, etc.)
-- are stored as plain UUID columns WITHOUT FK constraints because users live in
-- the platform DB.  Application-layer validation is used instead.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Clients ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                       uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                uuid        NOT NULL,
  name                     text        NOT NULL,
  client_type              text,
  industry                 text,
  company_size             text,
  tier                     text        NOT NULL DEFAULT 'standard'
                             CHECK (tier IN ('priority', 'standard')),
  website                  text,
  linkedin                 text,
  logo_url                 text,
  headquarters_location    text,
  operating_locations      text[]      DEFAULT '{}',
  address                  text,
  city                     text,
  country                  text        DEFAULT 'India',
  primary_contact_name     text,
  primary_contact_email    text,
  primary_contact_phone    text,
  alternate_contact        text,
  engagement_type          text,
  hiring_volume            integer,
  active_requirements      integer     DEFAULT 0,
  client_priority          text,
  sla                      text,
  working_hours            text,
  billing_model            text,
  currency                 text        DEFAULT 'INR',
  markup                   text,
  payment_terms            text,
  invoice_cycle            text,
  billing_contact          text,
  contract_start           date,
  contract_end             date,
  msa_signed               boolean     DEFAULT false,
  nda_signed               boolean     DEFAULT false,
  preferred_skills         text[]      DEFAULT '{}',
  typical_roles            text[]      DEFAULT '{}',
  candidate_preference     text,
  hiring_strategy          text,
  interview_process        text,
  evaluation_criteria      text,
  positions_closed         integer     DEFAULT 0,
  avg_closure_time         numeric,
  interview_ratio          numeric,
  offer_acceptance_rate    numeric,
  preferred_channel        text,
  update_frequency         text,
  auto_report              boolean     DEFAULT false,
  account_manager          text,
  delivery_lead            text,
  recruiters               text[]      DEFAULT '{}',
  tags                     text[]      DEFAULT '{}',
  notes                    text,
  sla_hours                integer     NOT NULL DEFAULT 48,
  is_active                boolean     NOT NULL DEFAULT true,
  created_by               uuid,       -- references platform DB users(id), no FK
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

-- ─── Client stakeholders ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_stakeholders (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id  uuid        NOT NULL,
  name       text        NOT NULL,
  role       text,
  email      text,
  phone      text,
  timezone   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Jobs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            uuid        NOT NULL,
  client_id            uuid        NOT NULL REFERENCES clients(id),
  title                text        NOT NULL,
  department           text,
  location             text,
  work_mode            text        NOT NULL DEFAULT 'onsite'
                         CHECK (work_mode IN ('remote','hybrid','onsite')),
  employment_type      text        NOT NULL DEFAULT 'full_time'
                         CHECK (employment_type IN ('full_time','part_time','contract','internship')),
  experience_min       integer     DEFAULT 0,
  experience_max       integer     DEFAULT 10,
  salary_min           numeric,
  salary_max           numeric,
  currency             text        DEFAULT 'INR',
  headcount            integer     NOT NULL DEFAULT 1,
  priority             text        NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('low','medium','high','critical')),
  status               text        NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','pending_review','active','on_hold','closed_filled','closed_cancelled','expired')),
  description          text,
  mandatory_skills     text[]      DEFAULT '{}',
  preferred_skills     text[]      DEFAULT '{}',
  assigned_recruiter_id  uuid,         -- references platform DB users(id), no FK
  assigned_vendor_id     uuid,         -- references vendors(id) in this DB
  assigned_recruiter_ids uuid[] DEFAULT '{}',
  assigned_vendor_ids    uuid[] DEFAULT '{}',
  target_start_date    date,
  sla_deadline         timestamptz,
  created_by           uuid,        -- references platform DB users(id), no FK
  approved_by          uuid,        -- references platform DB users(id), no FK
  approved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

-- ─── Candidates ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          uuid        NOT NULL,
  first_name         text        NOT NULL,
  last_name          text        NOT NULL,
  email              text,
  phone              text,
  current_title      text,
  current_company    text,
  experience_years   numeric     DEFAULT 0,
  current_location   text,
  preferred_location text,
  notice_period_days integer     DEFAULT 30,
  current_ctc        numeric,
  expected_ctc       numeric,
  skills             text[]      DEFAULT '{}',
  summary            text,
  resume_url         text,
  resume_data        bytea,
  resume_mime_type   text,
  source             text        DEFAULT 'direct'
                       CHECK (source IN ('linkedin','indeed','naukri','monster','glassdoor','vendor','referral','direct','other')),
  gdpr_consent       boolean     DEFAULT false,
  is_active          boolean     DEFAULT true,
  embedding          vector(768),
  embedding_updated_at timestamptz,
  created_by         uuid,       -- references platform DB users(id), no FK
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

-- HNSW: no training step required (unlike IVFFlat), which matters for a freshly
-- provisioned tenant DB that starts with zero embedded candidates.
CREATE INDEX IF NOT EXISTS idx_candidates_embedding ON candidates
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ─── Job Applications (pipeline) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_applications (
  id                  uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           uuid    NOT NULL,
  job_id              uuid    NOT NULL REFERENCES jobs(id),
  candidate_id        uuid    NOT NULL REFERENCES candidates(id),
  stage               text    NOT NULL DEFAULT 'new'
                        CHECK (stage IN ('new','sourced','screened','shortlisted',
                                         'submitted_to_client','client_interview_scheduled',
                                         'interview_completed','selected','offer_extended',
                                         'offer_accepted','offer_rejected','joined','disqualified')),
  ai_score            numeric,
  ai_match_breakdown  jsonb,
  rejection_reason    text,
  notes               text,
  assigned_to         uuid,   -- references platform DB users(id), no FK
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, job_id, candidate_id)
);

-- ─── Pipeline events (immutable audit log) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_events (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      uuid        NOT NULL,
  application_id uuid        NOT NULL REFERENCES job_applications(id),
  from_stage     text,
  to_stage       text        NOT NULL,
  changed_by     uuid,       -- references platform DB users(id), no FK
  note           text,
  actor_type     text        CHECK (actor_type IN ('human','ai')) DEFAULT 'human',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── Vendors ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id                       uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                uuid        NOT NULL,
  company_name             text        NOT NULL,
  registration_number      text,
  gst_id                   text,
  primary_contact_name     text        NOT NULL,
  primary_contact_email    text        NOT NULL,
  primary_contact_phone    text,
  industry_specializations text[]      DEFAULT '{}',
  geographies              text[]      DEFAULT '{}',
  tier                     text        NOT NULL DEFAULT 'standard'
                             CHECK (tier IN ('preferred','standard','blocked')),
  quality_score            numeric     DEFAULT 0,
  submission_count         integer     DEFAULT 0,
  shortlist_rate           numeric     DEFAULT 0,
  fill_rate                numeric     DEFAULT 0,
  sla_adherence            numeric     DEFAULT 100,
  is_active                boolean     DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

-- ─── Email campaigns ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaigns (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid        NOT NULL,
  name             text        NOT NULL,
  subject          text        NOT NULL,
  body             text        NOT NULL,
  status           text        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  recipient_count  integer     DEFAULT 0,
  delivered_count  integer     DEFAULT 0,
  opened_count     integer     DEFAULT 0,
  clicked_count    integer     DEFAULT 0,
  bounced_count    integer     DEFAULT 0,
  unsubscribed_count integer   DEFAULT 0,
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  created_by       uuid,       -- references platform DB users(id), no FK
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Interviews ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interviews (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid        NOT NULL,
  application_id   uuid        NOT NULL REFERENCES job_applications(id),
  interview_type   text        NOT NULL DEFAULT 'phone'
                     CHECK (interview_type IN ('phone','video','face_to_face')),
  scheduled_at     timestamptz NOT NULL,
  duration_minutes integer     DEFAULT 60,
  interviewer_name  text,
  interviewer_email text,
  meeting_link     text,
  feedback_score   numeric,
  feedback_notes   text,
  status           text        NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  created_by       uuid,       -- references platform DB users(id), no FK
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Schema version tracking ─────────────────────────────────────────────────
-- Records which migrations have been applied to this tenant DB.
-- The schema runner inserts a row here after each successful migration.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text        PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the initial version so the runner can detect the baseline
INSERT INTO schema_migrations (version) VALUES ('001_initial') ON CONFLICT DO NOTHING;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_t_candidates_tenant_deleted  ON candidates(tenant_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_t_candidates_email           ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_t_jobs_tenant_status         ON jobs(tenant_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_t_jobs_client                ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_t_clients_tenant_deleted     ON clients(tenant_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_t_job_applications_job       ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_t_job_applications_candidate ON job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_t_job_applications_tenant    ON job_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_t_job_applications_assigned  ON job_applications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_t_pipeline_events_application ON pipeline_events(application_id);
CREATE INDEX IF NOT EXISTS idx_t_interviews_application     ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_t_vendors_tenant             ON vendors(tenant_id);
