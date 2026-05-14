/**
 * Tenant Resolution Middleware
 *
 * Resolves the current tenant from the incoming HTTP request.
 * Supports three resolution strategies (checked in priority order):
 *
 *   1. JWT claim  — tenant_id already in the decoded token (existing behaviour,
 *                   always present after login via softAuth/authMiddleware)
 *   2. Subdomain  — acme.zorhire.com → slug "acme" → tenant lookup
 *   3. Header     — X-Tenant-Slug: acme (useful for API clients / Postman)
 *
 * This middleware is ADDITIVE — it enriches req.resolvedTenant but never
 * rejects requests.  Existing auth middleware (authMiddleware, tenantIsolation)
 * continues to be the source of truth for access control.
 *
 * The resolved tenant info is used by the DB routing layer to decide which
 * pool to use (platform DB vs tenant-isolated DB) once the cutover per tenant
 * is complete.
 *
 * ── Non-breaking guarantee ──────────────────────────────────────────────────
 * If subdomain resolution fails or returns no match, the middleware calls
 * next() silently.  The system falls back to the JWT-based tenant_id (which
 * all existing controllers already use).  Nothing breaks.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { platformPool } from "../db/platform";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResolvedTenant {
  tenantId: string;
  slug: string;
  name: string;
  isActive: boolean;
  isProvisioned: boolean;
  dbName: string | null;
  resolutionSource: "jwt" | "subdomain" | "header";
}

declare global {
  namespace Express {
    interface Request {
      resolvedTenant?: ResolvedTenant;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_DOMAINS = new Set([
  "zorhire.com",
  "www.zorhire.com",
  "localhost",
  "127.0.0.1",
]);

/**
 * Extract subdomain from a Host header value.
 * "acme.zorhire.com" → "acme"
 * "zorhire.com" → null (no subdomain)
 * "localhost:5173" → null (dev — no subdomain)
 */
function extractSubdomain(host: string | undefined): string | null {
  if (!host) return null;
  const hostWithoutPort = host.split(":")[0];
  const parts = hostWithoutPort.split(".");

  // Need at least 3 parts for a subdomain: sub.domain.tld
  if (parts.length < 3) return null;

  // Skip known platform domains
  const domainWithoutSub = parts.slice(1).join(".");
  if (PLATFORM_DOMAINS.has(domainWithoutSub)) {
    return parts[0];
  }

  // For single-label domains in dev (e.g., acme.localhost) treat as subdomain
  if (parts.length === 2 && parts[1] === "localhost") {
    return parts[0];
  }

  return null;
}

/**
 * Look up a tenant by slug in the platform DB.
 */
async function lookupTenantBySlug(slug: string): Promise<ResolvedTenant | null> {
  const result = await platformPool.query<{
    tenant_id: string;
    slug: string;
    name: string;
    is_active: boolean;
  }>(
    `SELECT t.id AS tenant_id, t.slug, t.name, t.is_active
     FROM tenants t
     WHERE t.slug = $1
     LIMIT 1`,
    [slug.toLowerCase()],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    isActive: row.is_active,
    isProvisioned: false,
    dbName: null,
    resolutionSource: "subdomain",
  };
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Resolve tenant from subdomain or X-Tenant-Slug header.
 * Enriches req.resolvedTenant.  Never rejects — always calls next().
 *
 * Apply this AFTER softAuth so req.user is available for JWT-based resolution.
 *
 * Usage in index.ts:
 *   import { resolveTenant } from "./middleware/tenantResolution";
 *   v1Router.use(softAuth);
 *   v1Router.use(resolveTenant);  // <-- add after softAuth
 */
export async function resolveTenant(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Strategy 1: Use JWT tenant_id (already resolved by softAuth — always preferred)
    // We still resolve slug/name/provisioning status if possible.
    if (req.user?.tenant_id) {
      // Try to enrich with DB registry info for the JWT tenant
      // (Non-blocking — fall back to minimal object if query fails)
      try {
        const result = await platformPool.query<{
          slug: string;
          name: string;
          is_active: boolean;
        }>(
          `SELECT t.slug, t.name, t.is_active
           FROM tenants t
           WHERE t.id = $1`,
          [req.user.tenant_id],
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          req.resolvedTenant = {
            tenantId: req.user.tenant_id,
            slug: row.slug,
            name: row.name,
            isActive: row.is_active,
            isProvisioned: false,
            dbName: null,
            resolutionSource: "jwt",
          };
        }
      } catch {
        // Non-fatal — system degrades gracefully
      }
      return next();
    }

    // Strategy 2: Subdomain resolution
    const subdomain = extractSubdomain(req.headers.host);
    if (subdomain && subdomain !== "www" && subdomain !== "api") {
      const tenant = await lookupTenantBySlug(subdomain);
      if (tenant) {
        req.resolvedTenant = { ...tenant, resolutionSource: "subdomain" };
        return next();
      }
    }

    // Strategy 3: X-Tenant-Slug header (useful for API clients)
    const slugHeader = req.headers["x-tenant-slug"];
    if (slugHeader && typeof slugHeader === "string") {
      const tenant = await lookupTenantBySlug(slugHeader);
      if (tenant) {
        req.resolvedTenant = { ...tenant, resolutionSource: "header" };
        return next();
      }
    }
  } catch (err: any) {
    // Tenant resolution errors must never break the request pipeline
    console.warn("[tenantResolution] Error during tenant resolution:", err?.message);
  }

  next();
}
