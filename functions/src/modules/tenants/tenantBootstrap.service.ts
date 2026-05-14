import bcrypt from "bcryptjs";
import pool from "../../db";
import { initOnboardingStatus } from "../onboarding/onboarding.service";
import { sendPlatformEmail, buildWelcomeEmail } from "../../lib/platformEmail.service";
import env from "../../config/env";

export const PLATFORM_TENANT_ID = "77777777-7777-7777-7777-777777777777";

export interface OnboardCompanyInput {
  companyName: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  gstNumber?: string;
  country?: string;
  onboardedBy?: string;
}

export interface BootstrapResult {
  tenantId: string;
  userId: string;
}

/**
 * Provisions a new onboarding company in one atomic transaction:
 *   tenant row → admin user → profile → membership
 *
 * No subscription is created here. The company must purchase a plan via the
 * billing flow before accessing the ATS. ZorTech (platform owner) bypasses
 * all subscription checks and is never created via this path.
 */
export async function bootstrapTenant(
  input: OnboardCompanyInput,
): Promise<BootstrapResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Create tenant (always onboarding company — is_platform_owner = false)
    const tenantResult = await client.query(
      `INSERT INTO tenants (
         name, slug, is_platform_owner,
         company_email, company_phone, company_address, gst_number,
         country, onboarded_by, onboarded_at, is_active
       ) VALUES ($1,$2,false,$3,$4,$5,$6,$7,$8,now(),true)
       RETURNING id`,
      [
        input.companyName,
        input.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        input.companyEmail || null,
        input.companyPhone || null,
        input.companyAddress || null,
        input.gstNumber || null,
        input.country || "India",
        input.onboardedBy || null,
      ],
    );
    const tenantId: string = tenantResult.rows[0].id;

    // 2. Create admin user (must_change_password=true forces first-login reset)
    const hashedPassword = await bcrypt.hash(input.adminPassword, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password, must_change_password, is_active)
       VALUES ($1,$2,true,true)
       RETURNING id`,
      [input.adminEmail.trim().toLowerCase(), hashedPassword],
    );
    const userId: string = userResult.rows[0].id;

    // 3. Profile
    await client.query(
      `INSERT INTO profiles (id, email, full_name) VALUES ($1,$2,$3)`,
      [userId, input.adminEmail.trim().toLowerCase(), input.adminFullName],
    );

    // 4. Assign super_admin role within the new tenant
    await client.query(
      `INSERT INTO tenant_memberships (user_id, tenant_id, role, is_active)
       VALUES ($1,$2,'super_admin',true)`,
      [userId, tenantId],
    );

    // 5. Initialise the onboarding checklist row
    await initOnboardingStatus(tenantId, client);

    await client.query("COMMIT");

    // Send welcome email after the transaction commits (non-blocking)
    sendPlatformEmail({
      to: input.adminEmail,
      subject: "You're in — let's build your dream team 🚀",
      html: buildWelcomeEmail({
        firstName: input.adminFullName.split(" ")[0],
        companyName: input.companyName,
        planName: "ZorHire",
        frontendUrl: env.FRONTEND_URL || "https://app.zorhire.com",
      }),
    }).catch((err) =>
      console.warn("[bootstrapTenant] Welcome email failed (non-fatal):", err?.message),
    );

    return { tenantId, userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface TenantAccessStatus {
  active: boolean;
  reason?: "no_subscription" | "subscription_expired" | "cancelled" | "tenant_not_found";
  isPlatformOwner?: boolean;
}

/**
 * Checks whether a tenant is allowed to use the platform.
 * Platform owner (ZorTech) is always active.
 * Onboarding companies need an active, paid subscription.
 *
 * Called by the subscriptionCheck middleware on every authenticated request.
 */
export async function isTenantActive(
  tenantId: string,
): Promise<TenantAccessStatus> {
  if (tenantId === PLATFORM_TENANT_ID) {
    return { active: true, isPlatformOwner: true };
  }

  const result = await pool.query(
    `SELECT t.is_platform_owner, s.status, s.end_date
     FROM tenants t
     LEFT JOIN subscriptions s ON s.tenant_id = t.id
     WHERE t.id = $1 AND t.is_active = true`,
    [tenantId],
  );

  if (result.rows.length === 0) {
    return { active: false, reason: "tenant_not_found" };
  }

  const row = result.rows[0];

  if (row.is_platform_owner) {
    return { active: true, isPlatformOwner: true };
  }

  if (!row.status) {
    return { active: false, reason: "no_subscription" };
  }

  if (row.status === "active") {
    if (row.end_date && new Date(row.end_date) < new Date()) {
      return { active: false, reason: "subscription_expired" };
    }
    return { active: true };
  }

  if (row.status === "cancelled") {
    if (row.end_date && new Date(row.end_date) > new Date()) {
      return { active: true };
    }
    return { active: false, reason: "cancelled" };
  }

  // expired or any other non-active status
  return { active: false, reason: "subscription_expired" };
}

/**
 * Generates a URL-safe slug from a company name.
 * Mirrors buildDbName() logic from companyBootstrap.ts.
 */
export function buildTenantSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
