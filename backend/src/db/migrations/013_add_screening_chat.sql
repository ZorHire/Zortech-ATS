-- Migration 013: A5 screening chatbot session storage.
-- Lives in the shared platform DB deliberately, not the per-tenant DB — the public
-- candidate-facing routes receive only a session id from the URL with no way to know
-- which tenant DB it belongs to, so these tables must be reachable from one place
-- regardless of tenant. Same rationale as ai_call_log (migration 010).
-- tenant_id/application_id are plain UUID columns without FK constraints (cross-DB
-- references) — same pattern already used for created_by/assigned_recruiter_id in
-- functions/src/db/tenantSchema.sql, application-layer validated instead.
CREATE TABLE IF NOT EXISTS screening_sessions (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        uuid        NOT NULL,
  application_id   uuid        NOT NULL,
  token_hash       text        NOT NULL UNIQUE,
  status           text        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','completed','expired','revoked')),
  message_count    integer     NOT NULL DEFAULT 0,
  captured_answers jsonb,
  expires_at       timestamptz NOT NULL,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screening_messages (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid        NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('assistant','candidate')),
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_screening_sessions_application ON screening_sessions(application_id);
CREATE INDEX IF NOT EXISTS idx_screening_messages_session ON screening_messages(session_id);
