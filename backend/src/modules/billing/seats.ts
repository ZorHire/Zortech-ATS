/**
 * Per-user (seat) pricing for subscription checkout.
 *
 * Seats = active staff users in the company (super_admin, accounts_manager,
 * recruiter, vendor_manager), but never fewer than the plan's minimum.
 * Vendor-portal and client-portal users are free. This matches
 * `billable_users` in services/aiAllowance.ts (feat/ai-allowances).
 *
 * Seats are fixed when the admin pays. Users added during the period are not
 * charged until the next payment (renewal or plan change), which re-counts.
 */
import pool from "../../db";

export type PlanType = "starter" | "growth" | "enterprise";
export type BillingCycle = "monthly" | "yearly";

export const STAFF_ROLES = ["super_admin", "accounts_manager", "recruiter", "vendor_manager"];

export interface PlanPricing {
  id: string;
  name: string;
  price_monthly: number; // ₹ per user per month, billed monthly
  price_yearly: number; // ₹ per user per month, billed yearly
  user_min: number;
  user_max: number | null;
}

export interface SeatQuote {
  plan_type: PlanType;
  billing_cycle: BillingCycle;
  staff_users: number; // active staff users right now
  seats: number; // seats charged = max(staff_users, user_min)
  unit_price: number; // ₹ per user per month
  months: number; // 1 or 12
  amount_paisa: number; // total charged now
  eligible: boolean; // false when the company is above the plan's user_max
  reason: string | null;
}

export function buildQuote(plan: PlanPricing, billing_cycle: BillingCycle, staffUsers: number): SeatQuote {
  const seats = Math.max(staffUsers, plan.user_min);
  const unit_price = billing_cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
  const months = billing_cycle === "yearly" ? 12 : 1;
  const tooMany = plan.user_max != null && staffUsers > plan.user_max;
  return {
    plan_type: plan.id as PlanType,
    billing_cycle,
    staff_users: staffUsers,
    seats,
    unit_price,
    months,
    amount_paisa: unit_price * 100 * months * seats,
    eligible: !tooMany,
    reason: tooMany
      ? `${plan.name} covers up to ${plan.user_max} users and your company has ${staffUsers}. Choose a bigger plan.`
      : null,
  };
}

/** Active staff users (the people who are billed) in a company. */
export async function countStaffUsers(
  tenantId: string,
  db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> } = pool,
): Promise<number> {
  const r = await db.query(
    `SELECT count(*)::int AS n FROM tenant_memberships
      WHERE tenant_id = $1 AND is_active AND role = ANY($2)`,
    [tenantId, STAFF_ROLES],
  );
  return r.rows[0]?.n ?? 0;
}
