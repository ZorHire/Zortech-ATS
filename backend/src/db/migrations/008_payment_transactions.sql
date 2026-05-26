-- Migration 008: payment_transactions table for full Razorpay audit trail
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
