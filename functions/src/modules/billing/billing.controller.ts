import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import pool from "../../db";

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

/** GET /v1/billing/plans — public within tenant, returns static plan catalogue */
export const getPlans = (_req: AuthRequest, res: Response) => {
  res.json(PLANS);
};

/** GET /v1/billing/current — returns the active subscription for the caller's tenant */
export const getCurrentSubscription = async (
  req: AuthRequest,
  res: Response,
) => {
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

/**
 * POST /v1/billing/subscribe
 * Body: { plan_type, billing_cycle }
 *
 * Creates or updates the tenant subscription.
 * Razorpay-ready: when RAZORPAY_KEY_ID is configured, creates a Razorpay
 * subscription and returns the checkout_url. Otherwise activates directly.
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

  try {
    // Razorpay integration point — wire in when RAZORPAY_KEY_ID secret is present.
    // const razorpay = new Razorpay({ key_id, key_secret });
    // const rzpSub = await razorpay.subscriptions.create({ plan_id, total_count, ... });
    // Return rzpSub.short_url as checkout_url.

    const now = new Date();
    const endDate =
      billing_cycle === "yearly"
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const result = await pool.query(
      `INSERT INTO subscriptions
         (tenant_id, plan_type, billing_cycle, status, start_date, end_date)
       VALUES ($1, $2, $3, 'active', now(), $4)
       ON CONFLICT (tenant_id) DO UPDATE SET
         plan_type    = EXCLUDED.plan_type,
         billing_cycle = EXCLUDED.billing_cycle,
         status       = 'active',
         start_date   = now(),
         end_date     = EXCLUDED.end_date,
         updated_at   = now()
       RETURNING *`,
      [tenantId, plan_type, billing_cycle, endDate],
    );

    res.status(201).json({
      subscription: result.rows[0],
      checkout_url: null, // populated once Razorpay is wired in
    });
  } catch (err) {
    console.error("[billing] subscribe error:", err);
    res.status(500).json({ message: "Failed to create subscription" });
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
      return res
        .status(404)
        .json({ message: "No active subscription to cancel" });
    }
    res.json({ message: "Subscription cancelled", subscription: result.rows[0] });
  } catch (err) {
    console.error("[billing] cancelSubscription error:", err);
    res.status(500).json({ message: "Failed to cancel subscription" });
  }
};
