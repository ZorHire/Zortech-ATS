-- Job board credentials per tenant (tokens encrypted with AES-256-GCM)
CREATE TABLE IF NOT EXISTS job_board_credentials (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid        NOT NULL,
  board_key        text        NOT NULL,   -- 'linkedin','indeed','naukri','monster','glassdoor','shine','timesjobs','internshala'
  access_token     text,                   -- AES-256-GCM encrypted
  refresh_token    text,                   -- AES-256-GCM encrypted
  token_expires_at timestamptz,
  webhook_secret   text,                   -- plain; used to verify incoming webhook signatures
  extra_config     jsonb       NOT NULL DEFAULT '{}',  -- board-specific: partner_id, publisher_id, etc.
  connected_at     timestamptz NOT NULL DEFAULT now(),
  created_by       uuid        REFERENCES users(id),
  UNIQUE (tenant_id, board_key)
);

CREATE INDEX IF NOT EXISTS idx_job_board_creds_tenant
  ON job_board_credentials(tenant_id);

-- Per-job posting status on each board
CREATE TABLE IF NOT EXISTS job_board_postings (
  id                uuid  PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid  NOT NULL,
  job_id            uuid  NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  board_key         text  NOT NULL,
  external_job_id   text,                  -- ID returned by the board after posting
  status            text  NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','expired','error','withdrawn')),
  posted_at         timestamptz,
  expires_at        timestamptz,
  error_message     text,
  application_count int   NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, job_id, board_key)
);

CREATE INDEX IF NOT EXISTS idx_job_board_postings_job
  ON job_board_postings(job_id);

CREATE INDEX IF NOT EXISTS idx_job_board_postings_tenant
  ON job_board_postings(tenant_id, status);

-- Lookup by external_job_id used during webhook ingestion
CREATE INDEX IF NOT EXISTS idx_job_board_postings_ext_id
  ON job_board_postings(board_key, external_job_id) WHERE external_job_id IS NOT NULL;
