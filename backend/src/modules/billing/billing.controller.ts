import { Response } from "express";
import crypto from "crypto";
import axios from "axios";
import { AuthRequest } from "../../middleware/auth";
import pool from "../../db";
import env from "../../config/env";
import { buildQuote, countStaffUsers } from "./seats";

import type { PlanType, BillingCycle } from "./seats";
import { clearSubscriptionCache } from "./subscriptionAccess";
import { clearAllowanceCache } from "../../services/aiAllowance";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    description: "For small HR firms exploring ATS fundamentals.",
    price_monthly: 4333,
    price_yearly: 3683,
    user_min: 5,
    user_max: 25,
    recommended: false,
    features: [
      { label: "Job posting & pipeline management", included: true },
      { label: "Candidate database (2,000 records)", included: true },
      { label: "Email notifications & templates", included: true },
      { label: "Standard reports & dashboards", included: true },
      { label: "Up to 3 job board integrations", included: true },
      { label: "AI resume screening & ranking", included: false },
      { label: "Interview scheduling automation", included: false },
      { label: "Role-based access control", included: false },
      { label: "Advanced analytics", included: false },
      { label: "API access", included: false },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    description: "Built for mid-size HR firms that need speed and structure.",
    price_monthly: 5416,
    price_yearly: 4604,
    user_min: 26,
    user_max: 150,
    recommended: true,
    features: [
      { label: "Everything in Starter", included: true },
      { label: "Unlimited candidate database", included: true },
      { label: "AI resume screening & ranking", included: true },
      { label: "Interview scheduling automation", included: true },
      { label: "Role-based access control", included: true },
      { label: "Advanced analytics & custom reports", included: true },
      { label: "API access (10,000 calls/mo)", included: true },
      { label: "Up to 10 job board integrations", included: true },
      { label: "Priority support (8hr SLA)", included: true },
      { label: "White-label / custom integrations", included: false },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Power, customization, and support for large enterprises.",
    price_monthly: 6189,
    price_yearly: 4951,
    user_min: 150,
    user_max: null,
    recommended: false,
    features: [
      { label: "Everything in Growth", included: true },
      { label: "Unlimited API access", included: true },
      { label: "White-label option", included: true },
      { label: "Custom HRMS / ERP / SSO integrations", included: true },
      { label: "Unlimited job board integrations", included: true },
      { label: "Dedicated Customer Success Manager", included: true },
      { label: "2hr dedicated support SLA", included: true },
      { label: "99.9% uptime SLA", included: true },
      { label: "On-premise deployment option", included: true },
      { label: "Volume discounts available", included: true },
    ],
  },
];

const VALID_PLANS: PlanType[] = ["starter", "growth", "enterprise"];
const VALID_CYCLES: BillingCycle[] = ["monthly", "yearly"];

const planById = (plan_type: PlanType) => PLANS.find((p) => p.id === plan_type)!;

/** Price × seats for this company right now. Used by /quote and /subscribe so they always agree. */
const quoteFor = async (tenantId: string, plan_type: PlanType, billing_cycle: BillingCycle) =>
  buildQuote(planById(plan_type), billing_cycle, await countStaffUsers(tenantId));

/** GET /v1/billing/plans — returns static plan catalogue */
export const getPlans = (_req: AuthRequest, res: Response) => {
  res.json(PLANS);
};

/**
 * GET /v1/billing/quote — what checkout would charge right now, for every plan
 * and billing cycle: per-user price × seats (active staff users, at least the
 * plan minimum). Shown to the admin before they pay.
 */
export const getQuote = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const staffUsers = await countStaffUsers(tenantId);
    const quotes = PLANS.flatMap((p) =>
      VALID_CYCLES.map((c) => buildQuote(p, c, staffUsers)),
    );
    res.json({ staff_users: staffUsers, quotes });
  } catch (err) {
    console.error("[billing] getQuote error:", err);
    res.status(500).json({ message: "Failed to price your plan" });
  }
};

/** GET /v1/billing/current — active subscription for the caller's tenant */
export const getCurrentSubscription = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No active subscription found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[billing] getCurrentSubscription error:", err);
    res.status(500).json({ message: "Failed to fetch subscription" });
  }
};

/** GET /v1/billing/transactions — payment history for the caller's tenant */
export const getTransactions = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `SELECT id, razorpay_order_id, razorpay_payment_id, plan_type,
              billing_cycle, amount::float8 AS amount, seats, unit_price_paisa,
              currency, status, failure_reason, created_at
       FROM payment_transactions
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [tenantId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[billing] getTransactions error:", err);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
};

/**
 * POST /v1/billing/subscribe
 * Creates a Razorpay order and stores a pending payment_transactions record.
 * The subscription is NOT activated here — only after verify-payment succeeds.
 */
export const subscribe = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const { plan_type, billing_cycle, expected_amount } = req.body as {
    plan_type: PlanType;
    billing_cycle: BillingCycle;
    /** Total (paisa) the admin was shown. If users changed since, we ask them to re-check. */
    expected_amount?: number;
  };

  if (!VALID_PLANS.includes(plan_type)) {
    return res.status(400).json({ message: "Invalid plan_type" });
  }
  // Enterprise is contact-sales only (large orders can exceed the Razorpay per-payment limit).
  if (plan_type === "enterprise") {
    return res.status(400).json({
      message: "Enterprise is set up by our sales team. Please contact ZorHire sales.",
      code: "CONTACT_SALES",
    });
  }
  if (!VALID_CYCLES.includes(billing_cycle)) {
    return res.status(400).json({ message: "Invalid billing_cycle" });
  }
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({
      message: "Payment gateway not configured. Please contact ZorHire support.",
      code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
    });
  }

  try {
    const quote = await quoteFor(tenantId, plan_type, billing_cycle);
    if (!quote.eligible) {
      return res.status(400).json({ message: quote.reason, code: "SEATS_EXCEED_PLAN", quote });
    }
    if (expected_amount != null && Number(expected_amount) !== quote.amount_paisa) {
      return res.status(409).json({
        message: "Your user count changed since this price was shown. Please check the new total.",
        code: "QUOTE_CHANGED",
        quote,
      });
    }
    const amountInPaisa = quote.amount_paisa;

    const orderRes = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount: amountInPaisa,
        currency: "INR",
        receipt: `sub_${tenantId.slice(0, 8)}_${Date.now()}`,
        notes: { plan_type, billing_cycle, tenant_id: tenantId, seats: String(quote.seats) },
      },
      {
        auth: { username: env.RAZORPAY_KEY_ID, password: env.RAZORPAY_KEY_SECRET },
      },
    );

    const order = orderRes.data;

    // Persist pending transaction so we always have a record
    await pool.query(
      `INSERT INTO payment_transactions
         (tenant_id, razorpay_order_id, plan_type, billing_cycle, amount, currency, status,
          seats, unit_price_paisa)
       VALUES ($1, $2, $3, $4, $5, 'INR', 'pending', $6, $7)
       ON CONFLICT (razorpay_order_id) DO NOTHING`,
      [tenantId, order.id, plan_type, billing_cycle, amountInPaisa, quote.seats, quote.unit_price * 100],
    );

    res.json({
      order_id: order.id,
      key_id: env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      plan_type,
      billing_cycle,
      seats: quote.seats,
      unit_price: quote.unit_price,
      months: quote.months,
    });
  } catch (err) {
    console.error("[billing] subscribe error:", err);
    res.status(500).json({ message: "Failed to initiate payment" });
  }
};

/**
 * POST /v1/billing/verify-payment
 * Verifies the Razorpay HMAC signature, activates the subscription in a DB
 * transaction, and marks the payment_transactions record as captured.
 */
export const verifyPayment = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan_type,
    billing_cycle,
  } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan_type: PlanType;
    billing_cycle: BillingCycle;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: "Missing Razorpay payment fields." });
  }
  if (!VALID_PLANS.includes(plan_type) || !VALID_CYCLES.includes(billing_cycle)) {
    return res.status(400).json({ message: "Invalid plan_type or billing_cycle." });
  }
  if (!env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({
      message: "Payment gateway not configured. Please contact ZorHire support.",
      code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
    });
  }

  // Verify HMAC-SHA256: key_secret over "order_id|payment_id"
  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    // Mark the pending transaction as failed (best-effort, non-critical)
    pool
      .query(
        `UPDATE payment_transactions
         SET status = 'failed', failure_reason = 'signature_mismatch', updated_at = now()
         WHERE razorpay_order_id = $1 AND tenant_id = $2 AND status = 'pending'`,
        [razorpay_order_id, tenantId],
      )
      .catch(() => {});
    return res.status(400).json({ message: "Payment verification failed. Invalid signature." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await activateOrder(client, {
      tenantId,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      fallback: { plan_type, billing_cycle },
    });
    await client.query("COMMIT");
    if (result.activated) {
      clearSubscriptionCache(tenantId);
      void clearAllowanceCache(tenantId);
    }
    res.status(201).json({ subscription: result.subscription });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[billing] verifyPayment error:", err);
    res.status(500).json({ message: "Failed to activate subscription" });
  } finally {
    client.release();
  }
};

type DbClient = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/**
 * Turns a paid Razorpay order into an active subscription. Runs inside the caller's
 * transaction. Used by verify-payment (the browser) and by the webhook (Razorpay's
 * servers, in case the browser closed before verifying), so it must be idempotent:
 * an order that is already captured changes nothing, and the plan is never extended twice.
 */
async function activateOrder(
  client: DbClient,
  opts: {
    tenantId: string;
    orderId: string;
    paymentId: string;
    signature: string | null;
    /** Only for orders with no record of ours (created before seat billing). */
    fallback?: { plan_type: PlanType; billing_cycle: BillingCycle };
  },
): Promise<{ activated: boolean; subscription: any }> {
  const { tenantId, orderId, paymentId, signature } = opts;

  // The order we created at /subscribe is the source of truth for plan, cycle
  // and seats, not the request body.
  const pending = await client.query(
    `SELECT plan_type, billing_cycle, seats, status FROM payment_transactions
      WHERE razorpay_order_id = $1 AND tenant_id = $2
      FOR UPDATE`,
    [orderId, tenantId],
  );
  const order = pending.rows[0] as
    | { plan_type: PlanType; billing_cycle: BillingCycle; seats: number | null; status: string }
    | undefined;

  if (order && order.status !== "pending" && order.status !== "failed") {
    // Already captured (or refunded): report the current subscription, change nothing.
    const sub = await client.query(`SELECT * FROM subscriptions WHERE tenant_id = $1`, [tenantId]);
    return { activated: false, subscription: sub.rows[0] ?? null };
  }
  if (!order && !opts.fallback) throw new Error(`No order ${orderId} for tenant ${tenantId}`);

  const planType: PlanType = order?.plan_type ?? opts.fallback!.plan_type;
  const cycle: BillingCycle = order?.billing_cycle ?? opts.fallback!.billing_cycle;
  let seats: number | null = order?.seats ?? null;

  // Renewing before the plan ends adds the new period on top of the days
  // already paid for; renewing after it ends starts the period today.
  const current = await client.query(
    `SELECT end_date FROM subscriptions
      WHERE tenant_id = $1 AND status IN ('active', 'trial', 'cancelled')
        AND end_date > now()
      FOR UPDATE`,
    [tenantId],
  );
  const now = new Date();
  const from: Date = current.rows[0]?.end_date ? new Date(current.rows[0].end_date) : now;
  const endDate =
    cycle === "yearly"
      ? new Date(from.getFullYear() + 1, from.getMonth(), from.getDate(), from.getHours(), from.getMinutes())
      : new Date(from.getFullYear(), from.getMonth() + 1, from.getDate(), from.getHours(), from.getMinutes());

  if (order) {
    await client.query(
      `UPDATE payment_transactions
       SET razorpay_payment_id = $1,
           razorpay_signature  = COALESCE($2, razorpay_signature),
           status              = 'captured',
           failure_reason      = NULL,
           updated_at          = now()
       WHERE razorpay_order_id = $3 AND tenant_id = $4`,
      [paymentId, signature, orderId, tenantId],
    );
  } else {
    // No record of ours (e.g. an order created before seat billing). Price it as of now.
    const quote = buildQuote(planById(planType), cycle, await countStaffUsers(tenantId, client));
    seats = quote.seats;
    await client.query(
      `INSERT INTO payment_transactions
         (tenant_id, razorpay_order_id, razorpay_payment_id, razorpay_signature,
          plan_type, billing_cycle, amount, currency, status, seats, unit_price_paisa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'INR', 'captured', $8, $9)`,
      [tenantId, orderId, paymentId, signature, planType, cycle, quote.amount_paisa, quote.seats, quote.unit_price * 100],
    );
  }

  // Activate / upgrade the subscription with the seats that were paid for
  const subResult = await client.query(
    `INSERT INTO subscriptions
       (tenant_id, plan_type, billing_cycle, status, razorpay_subscription_id, start_date, end_date, seats)
     VALUES ($1, $2, $3, 'active', $4, now(), $5, $6)
     ON CONFLICT (tenant_id) DO UPDATE SET
       plan_type                = EXCLUDED.plan_type,
       billing_cycle            = EXCLUDED.billing_cycle,
       status                   = 'active',
       razorpay_subscription_id = EXCLUDED.razorpay_subscription_id,
       start_date               = now(),
       end_date                 = EXCLUDED.end_date,
       seats                    = EXCLUDED.seats,
       updated_at               = now()
     RETURNING *`,
    [tenantId, planType, cycle, paymentId, endDate, seats],
  );
  console.log(`[billing] Subscription activated — tenant=${tenantId} plan=${planType} cycle=${cycle} seats=${seats}`);
  return { activated: true, subscription: subResult.rows[0] };
}

/** POST /v1/billing/cancel — marks the tenant subscription as cancelled */
export const cancelSubscription = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = now()
       WHERE tenant_id = $1 AND status = 'active'
       RETURNING *`,
      [tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No active subscription to cancel" });
    }
    clearSubscriptionCache(tenantId);
    void clearAllowanceCache(tenantId);
    res.json({ message: "Subscription cancelled", subscription: result.rows[0] });
  } catch (err) {
    console.error("[billing] cancelSubscription error:", err);
    res.status(500).json({ message: "Failed to cancel subscription" });
  }
};

/**
 * POST /v1/billing/refund — ZorTech only (platform-owner super_admin / accounts_manager).
 * Customers can't refund their own payments; they ask ZorTech, which refunds here.
 * Body: { payment_id, amount? (₹, omit for a full refund), notes? }
 */
export const refundPayment = async (req: AuthRequest, res: Response) => {
  const { payment_id, amount, notes } = req.body ?? {};
  if (typeof payment_id !== "string" || !payment_id) return res.status(400).json({ message: "payment_id is required" });
  try {
    const owner = await pool.query(`SELECT is_platform_owner FROM tenants WHERE id = $1`, [req.user!.tenant_id]);
    if (!owner.rows[0]?.is_platform_owner) {
      return res.status(403).json({ message: "Refunds are handled by ZorTech. Please contact support." });
    }
    const txn = await pool.query(
      `SELECT id, tenant_id, amount, status FROM payment_transactions WHERE razorpay_payment_id = $1`,
      [payment_id],
    );
    const t = txn.rows[0];
    if (!t) return res.status(404).json({ message: "Payment not found" });
    if (t.status !== "captured") return res.status(409).json({ message: `This payment is ${t.status}, not captured.` });
    const paisa = amount != null ? Math.round(Number(amount) * 100) : undefined;
    if (paisa !== undefined && (!Number.isFinite(paisa) || paisa <= 0 || paisa > Number(t.amount))) {
      return res.status(400).json({ message: "amount must be more than 0 and no more than the payment" });
    }
    const Razorpay = require("razorpay");
    const razorpay = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
    const refund = await razorpay.payments.refund(payment_id, {
      amount: paisa,
      notes: typeof notes === "string" && notes ? { reason: notes.slice(0, 250) } : undefined,
    });
    const full = paisa === undefined || paisa === Number(t.amount);
    await pool.query(
      `UPDATE payment_transactions
          SET status = CASE WHEN $2 THEN 'refunded' ELSE status END,
              failure_reason = $3, updated_at = now()
        WHERE id = $1`,
      [t.id, full, `refund ${refund.id}${full ? "" : ` (partial: ₹${(paisa! / 100).toFixed(2)})`}`],
    );
    res.json({ message: "Refund initiated", refund_id: refund.id, status: refund.status, full });
  } catch (err: any) {
    console.error("refundPayment error:", err);
    res.status(500).json({ message: err?.error?.description || "Refund failed" });
  }
};

/**
 * POST /v1/billing/razorpay-webhook — called by Razorpay's servers.
 * On payment.captured / order.paid it activates the order exactly like verify-payment,
 * so a customer who paid but closed the browser before it verified still gets their plan.
 * The signature is checked over the raw request body (see express.json in index.ts).
 */
export const razorpayWebhook = async (req: any, res: Response) => {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not configured — rejecting webhook");
    return res.status(500).json({ message: "Webhook not configured" });
  }
  const signature = String(req.headers["x-razorpay-signature"] ?? "");
  const raw: Buffer | undefined = req.rawBody;
  if (!raw) return res.status(400).json({ message: "Missing body" });
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  const event = req.body;
  if (event?.event !== "payment.captured" && event?.event !== "order.paid") return res.json({ received: true });
  const payment = event.payload?.payment?.entity;
  const orderId: string | undefined = payment?.order_id ?? event.payload?.order?.entity?.id;
  const paymentId: string | undefined = payment?.id;
  if (!orderId || !paymentId) return res.json({ received: true });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const known = await client.query(`SELECT tenant_id FROM payment_transactions WHERE razorpay_order_id = $1`, [orderId]);
    const tenantId: string | undefined = known.rows[0]?.tenant_id;
    if (!tenantId) {
      await client.query("ROLLBACK");
      console.warn(`[billing] webhook for unknown order ${orderId}; ignored`);
      return res.json({ received: true });
    }
    const result = await activateOrder(client, { tenantId, orderId, paymentId, signature: null });
    await client.query("COMMIT");
    if (result.activated) {
      clearSubscriptionCache(tenantId);
      void clearAllowanceCache(tenantId);
      console.log(`[billing] webhook activated order ${orderId} (browser never verified)`);
    }
    res.json({ received: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("razorpayWebhook error:", err);
    // 500 makes Razorpay retry later.
    res.status(500).json({ message: "Webhook processing failed" });
  } finally {
    client.release();
  }
};
