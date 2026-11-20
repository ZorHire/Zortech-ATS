-- Client submission packs (docs/submission-pack.md): a client-ready candidate profile per
-- job application, written by AI from the resume and edited by the recruiter.
CREATE TABLE IF NOT EXISTS submission_packs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  application_id  UUID NOT NULL UNIQUE REFERENCES job_applications(id) ON DELETE CASCADE,
  content         JSONB NOT NULL DEFAULT '{}'::jsonb,
  hide_contacts   BOOLEAN NOT NULL DEFAULT true,
  show_ctc        BOOLEAN NOT NULL DEFAULT true,
  ai_generated    BOOLEAN NOT NULL DEFAULT false,
  edited          BOOLEAN NOT NULL DEFAULT false,
  generated_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  sent_to         TEXT,
  updated_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submission_packs_tenant ON submission_packs (tenant_id);
