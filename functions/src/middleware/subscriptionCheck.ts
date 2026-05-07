import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { isTenantActive } from "../modules/tenants/tenantBootstrap.service";

/**
 * Express middleware that blocks requests from tenants without an active
 * or in-trial subscription.
 *
 * Rules:
 *  - ZorTech (platform owner) → always passes through
 *  - Onboarding company with active subscription → passes through
 *  - Onboarding company on trial (not expired) → passes through + sets X-Trial-Days-Left header
 *  - No subscription / trial expired / cancelled → 402 Payment Required
 *
 * Apply to all business routes (clients, jobs, vendors, etc.).
 * Do NOT apply to /auth/* or /billing/* so companies can log in and subscribe.
 */
export async function requireActiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const tenantId = req.user?.tenant_id;

  if (!tenantId) {
    // No valid token (softAuth couldn't decode it) — pass to the route's own
    // authMiddleware which will return 401. We must not return 401 here because
    // that would also fire for public auth endpoints that don't use authMiddleware.
    return next();
  }

  try {
    const access = await isTenantActive(tenantId);

    if (!access.active) {
      res.status(402).json({
        message: "Subscription required to access this resource.",
        code: access.reason || "subscription_required",
      });
      return;
    }

    next();
  } catch (err) {
    // Fail open on infra errors so an outage doesn't lock everyone out
    console.error("[subscriptionCheck] error:", err);
    next();
  }
}
