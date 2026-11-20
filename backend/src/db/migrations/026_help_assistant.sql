-- Help assistant (docs/help-assistant.md): questions users ask and whether the answer helped.
-- Used to rate-limit per user and to see which help articles are missing or unclear.

CREATE TABLE IF NOT EXISTS help_questions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  question    TEXT NOT NULL,
  answer      TEXT,
  page        TEXT,
  articles    JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai          BOOLEAN NOT NULL DEFAULT false,
  unanswered  BOOLEAN NOT NULL DEFAULT false,
  helpful     BOOLEAN,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_help_questions_user_time ON help_questions (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_help_questions_tenant_time ON help_questions (tenant_id, created_at);
