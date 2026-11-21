import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import env from "../config/env";
import { getCachedSubscriptionAccess } from "../modules/billing/subscriptionAccess";

/** Staff roles that need a paid plan. Vendor and client portal users are not blocked. */
const STAFF_ROLES = new Set(["super_admin", "accounts_manager", "recruiter", "vendor_manager"]);

/**
 * Paths staff can still use after the plan ends: sign in/out, see and renew the
 * plan, and finish onboarding. Everything else returns 402 SUBSCRIPTION_EXPIRED.
 */
const ALLOWED_PREFIXES = ["/auth", "/billing", "/onboarding", "/profile", "/notifications", "/demo-requests"];

/**
 * Blocks staff of a company whose plan has lapsed (expired, or cancelled and
 * past its paid period). Companies that never bought a plan are not blocked
 * here; the app sends them to the pricing page instead.
 *
 * Runs before the route's own auth. Requests without a valid staff token are
 * passed through untouched so the route answers them as it always has.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (ALLOWED_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + "/"))) return next();

  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return next();

  let claims: { role?: string; tenant_id?: string };
  try {
    claims = jwt.verify(token, env.JWT_SECRET) as typeof claims;
  } catch {
    return next(); // the route's authMiddleware returns the 401
  }
  if (!claims.tenant_id || !claims.role || !STAFF_ROLES.has(claims.role)) return next();

  try {
    const access = await getCachedSubscriptionAccess(claims.tenant_id);
    if (!access.active && (access.reason === "expired" || access.reason === "cancelled")) {
      return res.status(402).json({
        code: "SUBSCRIPTION_EXPIRED",
        message: "Your company's ZorHire plan has ended. Renew it to keep using ZorHire.",
        subscription: access,
      });
    }
  } catch (err) {
    // Don't lock everyone out because of a lookup error.
    console.error("[subscription] access check failed:", (err as Error).message);
  }
  next();
}
