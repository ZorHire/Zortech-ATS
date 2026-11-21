-- Migration 027: per-user (seat) billing
-- Plans are priced per user per month. Record how many seats each payment
-- covered and the per-user price used, so every charge can be explained later.
-- Safe to re-run.

ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS seats integer;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS unit_price_paisa integer;
-- A yearly order for a large team can pass 2^31 paisa (about ₹2.1 crore).
ALTER TABLE payment_transactions ALTER COLUMN amount TYPE bigint;

-- Seats paid for in the current subscription period.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS seats integer;
