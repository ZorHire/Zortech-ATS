CREATE TABLE IF NOT EXISTS search_history (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  query       text        NOT NULL DEFAULT '',
  filters     jsonb       NOT NULL DEFAULT '{}',
  result_count integer    NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_history_user_date
  ON search_history(user_id, tenant_id, created_at DESC);
