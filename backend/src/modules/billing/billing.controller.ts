import { Response } from "express";
import crypto from "crypto";
import axios from "axios";
import { AuthRequest } from "../../middleware/auth";
import pool from "../../db";
import env from "../../config/env";

type PlanType = "starter" | "growth" | "enterprise";
type BillingCycle = "monthly" | "yearly";

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

const planAmountInPaisa = (plan_type: PlanType, billing_cycle: BillingCycle): number => {
  const plan = PLANS.find((p) => p.id === plan_type)!;
  return billing_cycle === "yearly"
    ? plan.price_yearly * 12 * 100
    : plan.price_monthly * 100;
};

/** GET /v1/billing/plans — returns static plan catalogue */
export const getPlans = (_req: AuthRequest, res: Response) => {
  res.json(PLANS);
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
              billing_cycle, amount, currency, status, failure_reason, created_at
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
  const { plan_type, billing_cycle } = req.body as {
    plan_type: PlanType;
    billing_cycle: BillingCycle;
  };

  if (!VALID_PLANS.includes(plan_type)) {
    return res.status(400).json({ message: "Invalid plan_type" });
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

  const amountInPaisa = planAmountInPaisa(plan_type, billing_cycle);

  try {
    const orderRes = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount: amountInPaisa,
        currency: "INR",
        receipt: `sub_${tenantId.slice(0, 8)}_${Date.now()}`,
        notes: { plan_type, billing_cycle, tenant_id: tenantId },
      },
      {
        auth: { username: env.RAZORPAY_KEY_ID, password: env.RAZORPAY_KEY_SECRET },
      },
    );

    const order = orderRes.data;

    // Persist pending transaction so we always have a record
    await pool.query(
      `INSERT INTO payment_transactions
         (tenant_id, razorpay_order_id, plan_type, billing_cycle, amount, currency, status)
       VALUES ($1, $2, $3, $4, $5, 'INR', 'pending')
       ON CONFLICT (razorpay_order_id) DO NOTHING`,
      [tenantId, order.id, plan_type, billing_cycle, amountInPaisa],
    );

    res.json({
      order_id: order.id,
      key_id: env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      plan_type,
      billing_cycle,
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
         WHERE razorpay_order_id = $1 AND tenant_id = $2`,
        [razorpay_order_id, tenantId],
      )
      .catch(() => {});
    return res.status(400).json({ message: "Payment verification failed. Invalid signature." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const now = new Date();
    const endDate =
      billing_cycle === "yearly"
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Activate / upgrade subscription
    const subResult = await client.query(
      `INSERT INTO subscriptions
         (tenant_id, plan_type, billing_cycle, status, razorpay_subscription_id, start_date, end_date)
       VALUES ($1, $2, $3, 'active', $4, now(), $5)
       ON CONFLICT (tenant_id) DO UPDATE SET
         plan_type                = EXCLUDED.plan_type,
         billing_cycle            = EXCLUDED.billing_cycle,
         status                   = 'active',
         razorpay_subscription_id = EXCLUDED.razorpay_subscription_id,
         start_date               = now(),
         end_date                 = EXCLUDED.end_date,
         updated_at               = now()
       RETURNING *`,
      [tenantId, plan_type, billing_cycle, razorpay_payment_id, endDate],
    );

    // Update pending → captured; if no pending row exists, insert one
    const updateResult = await client.query(
      `UPDATE payment_transactions
       SET razorpay_payment_id = $1,
           razorpay_signature  = $2,
           status              = 'captured',
           updated_at          = now()
       WHERE razorpay_order_id = $3 AND tenant_id = $4
       RETURNING id`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id, tenantId],
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      // Fallback: no pending record (e.g. order created elsewhere)
      await client.query(
        `INSERT INTO payment_transactions
           (tenant_id, razorpay_order_id, razorpay_payment_id, razorpay_signature,
            plan_type, billing_cycle, amount, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'INR', 'captured')`,
        [
          tenantId,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          plan_type,
          billing_cycle,
          planAmountInPaisa(plan_type, billing_cycle),
        ],
      );
    }

    await client.query("COMMIT");
    console.log(`[billing] Subscription activated — tenant=${tenantId} plan=${plan_type} cycle=${billing_cycle}`);
    res.status(201).json({ subscription: subResult.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[billing] verifyPayment error:", err);
    res.status(500).json({ message: "Failed to activate subscription" });
  } finally {
    client.release();
  }
};

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
    res.json({ message: "Subscription cancelled", subscription: result.rows[0] });
  } catch (err) {
    console.error("[billing] cancelSubscription error:", err);
    res.status(500).json({ message: "Failed to cancel subscription" });
  }
};

export const refundPayment = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { payment_id, amount, notes } = req.body;
  if (!payment_id) return res.status(400).json({ message: 'payment_id is required' });
  try {
    // Verify the payment_id belongs to this tenant — razorpay_subscription_id is set
    // at subscription activation time (verifyPayment stores razorpay_payment_id there)
    const ownership = await pool.query(
      `SELECT id FROM subscriptions WHERE razorpay_subscription_id = $1 AND tenant_id = $2`,
      [payment_id, tenantId]
    );
    if (ownership.rows.length === 0) {
      return res.status(403).json({ message: 'Payment not found for this tenant' });
    }
    // Razorpay refund via REST API
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
    const refund = await razorpay.payments.refund(payment_id, {
      amount: amount ? Math.round(amount * 100) : undefined,
      notes: notes ? { reason: notes } : undefined,
    });
    // Update subscription/billing record
    await pool.query(
      `UPDATE subscriptions SET updated_at=now() WHERE payment_id=$1 AND tenant_id=$2`,
      [payment_id, tenantId]
    );
    res.json({ message: 'Refund initiated', refund_id: refund.id, status: refund.status });
  } catch (err: any) {
    console.error('refundPayment error:', err);
    res.status(500).json({ error: err?.error?.description || 'Refund failed' });
  }
};

export const razorpayWebhook = async (req: any, res: Response) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not configured — rejecting webhook');
    return res.status(500).json({ message: 'Webhook not configured' });
  }
  try {
    const crypto = require('crypto');
    const body = JSON.stringify(req.body);
    const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (!signature || !crypto.timingSafeEqual(Buffer.from(signature as string), Buffer.from(expectedSig))) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }
    const event = req.body;
    if (event.event === 'payment.captured') {
      const paymentId = event.payload?.payment?.entity?.id;
      const amount = event.payload?.payment?.entity?.amount;
      const notes = event.payload?.payment?.entity?.notes || {};
      if (notes.tenant_id) {
        await pool.query(
          `UPDATE subscriptions SET status='active', payment_id=$1, updated_at=now()
           WHERE tenant_id=$2 AND status='pending'`,
          [paymentId, notes.tenant_id]
        );
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('razorpayWebhook error:', err);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};
