import pool from "../../db";

/** Days before end_date when staff start seeing the renewal reminder. */
export const RENEWAL_REMINDER_DAYS = 7;

export interface SubscriptionAccess {
  /** May staff use the app right now? */
  active: boolean;
  isPlatformOwner: boolean;
  /** "active" | "trial" | "expired" | "cancelled" | "none" | "platform_owner" */
  reason: string;
  status: string | null;
  plan_type: string | null;
  end_date: string | null;
  /** Days until end_date, rounded up (1 = ends within a day). Null when not paid up or no end date. */
  days_left: number | null;
}

type Db = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Works out whether a company's plan currently lets its staff in.
 * A plan is usable until its end_date passes, even if the nightly job hasn't
 * marked it expired yet. A cancelled plan stays usable until the end of the
 * period that was paid for.
 */
export function computeAccess(
  row: { is_platform_owner?: boolean; status?: string | null; plan_type?: string | null; end_date?: Date | string | null } | undefined,
  now: Date = new Date(),
): SubscriptionAccess {
  const isPlatformOwner = !!row?.is_platform_owner;
  const status = row?.status ?? null;
  const end = row?.end_date ? new Date(row.end_date) : null;
  const lapsed = end != null && end.getTime() <= now.getTime();
  const days_left = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS)) : null;

  let reason: string;
  let paidUp: boolean;
  if (status === "active" || status === "trial") {
    paidUp = !lapsed;
    reason = lapsed ? "expired" : status;
  } else if (status === "cancelled") {
    paidUp = end != null && !lapsed;
    reason = "cancelled";
  } else if (status === "expired") {
    paidUp = false;
    reason = "expired";
  } else {
    paidUp = false;
    reason = "none";
  }
  if (!paidUp && isPlatformOwner) reason = "platform_owner";

  return {
    active: isPlatformOwner || paidUp,
    isPlatformOwner,
    reason,
    status,
    plan_type: row?.plan_type ?? null,
    end_date: end ? end.toISOString() : null,
    days_left: paidUp ? days_left : null,
  };
}

export async function getSubscriptionAccess(tenantId: string, db: Db = pool): Promise<SubscriptionAccess> {
  const { rows } = await db.query(
    `SELECT t.is_platform_owner, s.status, s.plan_type, s.end_date
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
      WHERE t.id = $1
      ORDER BY s.created_at DESC NULLS LAST
      LIMIT 1`,
    [tenantId],
  );
  return computeAccess(rows[0]);
}

/** Marks plans whose end date has passed as expired. Run nightly. */
export async function expireLapsedSubscriptions(db: Db = pool): Promise<number> {
  const result = (await db.query(
    `UPDATE subscriptions
        SET status = 'expired', updated_at = now()
      WHERE status IN ('active', 'trial', 'cancelled')
        AND end_date IS NOT NULL
        AND end_date <= now()
      RETURNING tenant_id`,
  )) as { rows: { tenant_id: string }[] };
  for (const r of result.rows) clearSubscriptionCache(r.tenant_id);
  return result.rows.length;
}

// ── Short-lived cache so the API block doesn't hit the DB on every request ──
const CACHE_MS = 60_000;
const cache = new Map<string, { access: SubscriptionAccess; at: number }>();

export async function getCachedSubscriptionAccess(tenantId: string): Promise<SubscriptionAccess> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.access;
  const access = await getSubscriptionAccess(tenantId);
  cache.set(tenantId, { access, at: Date.now() });
  return access;
}

export function clearSubscriptionCache(tenantId?: string) {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}
