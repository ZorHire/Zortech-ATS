-- Monthly AI allowances (docs/ai-allowances.md).
-- Each plan includes a number of Claude-powered actions per user per month, pooled
-- across the company. One row per action actually charged: the same candidate,
-- screening or prospect counts once per month however often it is re-run.

CREATE TABLE IF NOT EXISTS ai_usage (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meter       TEXT NOT NULL CHECK (meter IN ('shortlists','screenings','client_profiles','linkedin_prospects')),
  entity_id   UUID NOT NULL,
  month       DATE NOT NULL,              -- first day of the month (India time)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, meter, entity_id, month)
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_month ON ai_usage (tenant_id, month, meter);

-- Extra actions for one month on top of the plan (bought packs or goodwill credits).
CREATE TABLE IF NOT EXISTS ai_allowance_topups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meter       TEXT NOT NULL CHECK (meter IN ('shortlists','screenings','client_profiles','linkedin_prospects')),
  units       INTEGER NOT NULL CHECK (units > 0),
  month       DATE NOT NULL,
  note        TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_topups_tenant_month ON ai_allowance_topups (tenant_id, month);

-- One alert per level per meter per month, so admins are told once at 80% and once at 100%.
CREATE TABLE IF NOT EXISTS ai_usage_alerts (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meter       TEXT NOT NULL,
  month       DATE NOT NULL,
  level       INTEGER NOT NULL CHECK (level IN (80, 100)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, meter, month, level)
);
