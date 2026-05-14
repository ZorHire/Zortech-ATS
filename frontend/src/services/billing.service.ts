import api from "../lib/api";

export type PlanType = "starter" | "growth" | "enterprise";
export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "trial";

export interface PlanFeature {
  label: string;
  included: boolean;
  note?: string;
}

export interface Plan {
  id: PlanType;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  user_min: number;
  user_max: number | null;
  recommended: boolean;
  features: PlanFeature[];
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  start_date: string;
  end_date: string | null;
  razorpay_subscription_id: string | null;
}

export interface RazorpayOrderResponse {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  plan_type: PlanType;
  billing_cycle: BillingCycle;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  plan_type: PlanType;
  billing_cycle: BillingCycle;
}

export interface VerifyPaymentResponse {
  subscription: Subscription;
}

export const PLANS: Plan[] = [
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

export const billingService = {
  getPlans(): Promise<Plan[]> {
    return api.get("/billing/plans");
  },

  getCurrentSubscription(): Promise<Subscription | null> {
    return api.get("/billing/current").catch(() => null);
  },

  subscribe(
    plan_type: PlanType,
    billing_cycle: BillingCycle,
  ): Promise<RazorpayOrderResponse> {
    return api.post("/billing/subscribe", { plan_type, billing_cycle });
  },

  verifyPayment(payload: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    return api.post("/billing/verify-payment", payload);
  },

  cancelSubscription(): Promise<{ message: string }> {
    return api.post("/billing/cancel", {});
  },
};
