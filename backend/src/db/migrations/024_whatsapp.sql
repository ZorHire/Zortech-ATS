-- WhatsApp for candidate messages (docs/whatsapp.md).
-- Each recruiter sets their own number. "click" mode works with any WhatsApp number:
-- ZorHire prepares the message and opens WhatsApp; the recruiter presses Send.
-- "api" mode sends automatically through the company's WhatsApp Business (Cloud API)
-- account, using the recruiter's number registered there.

CREATE TABLE IF NOT EXISTS tenant_whatsapp_config (
  tenant_id         UUID PRIMARY KEY,
  waba_id           TEXT NOT NULL,
  access_token_enc  TEXT NOT NULL,
  app_secret_enc    TEXT NOT NULL,
  verify_token      TEXT NOT NULL UNIQUE,
  template_name     TEXT,
  template_lang     TEXT NOT NULL DEFAULT 'en',
  updated_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_whatsapp (
  tenant_id        UUID NOT NULL,
  user_id          UUID NOT NULL,
  phone_e164       TEXT NOT NULL,
  mode             TEXT NOT NULL DEFAULT 'click' CHECK (mode IN ('click','api')),
  phone_number_id  TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_whatsapp_pnid ON user_whatsapp (phone_number_id) WHERE phone_number_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  candidate_id  UUID,
  user_id       UUID,
  direction     TEXT NOT NULL CHECK (direction IN ('out','in')),
  mode          TEXT NOT NULL CHECK (mode IN ('click','api')),
  body          TEXT NOT NULL,
  template      TEXT,
  wa_message_id TEXT,
  status        TEXT NOT NULL CHECK (status IN ('prepared','sent','delivered','read','failed','received')),
  error         TEXT,
  from_number   TEXT,
  to_number     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wa_messages_candidate ON whatsapp_messages (tenant_id, candidate_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_message_id ON whatsapp_messages (wa_message_id) WHERE wa_message_id IS NOT NULL;
