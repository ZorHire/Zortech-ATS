-- Migration 010: ai_call_log for per-call cost/audit visibility on AI parser calls.
-- Lives in the shared platform DB (not per-tenant databases) since backend/ has no
-- tenant-DB routing and both backends share this same physical DB.
-- DPDP/GDPR: no raw prompt/response body storage here — metadata only.
CREATE TABLE IF NOT EXISTS ai_call_log (
  id             bigserial   PRIMARY KEY,
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id       text        NOT NULL,
  entity_type    text,
  entity_id      uuid,
  model          text        NOT NULL,
  prompt_version text        NOT NULL,
  input_tokens   integer,
  output_tokens  integer,
  cached_tokens  integer     DEFAULT 0,
  cost_usd       numeric(10,6),
  latency_ms     integer,
  success        boolean     NOT NULL,
  fallback_used  boolean     DEFAULT false,
  error_reason   text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_call_log_tenant_agent_created ON ai_call_log (tenant_id, agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_call_log_failures ON ai_call_log (created_at) WHERE success = false;
