import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import {
  bootstrapTenant,
  buildTenantSlug,
  PLATFORM_TENANT_ID,
} from "./tenantBootstrap.service";
import pool from "../../db";

/** POST /v1/tenants/onboard — ZorTech super_admin onboards a new company */
export const onboardCompany = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "super_admin" || req.user.tenant_id !== PLATFORM_TENANT_ID) {
    return res.status(403).json({ message: "Forbidden: only ZorTech super_admin can onboard companies" });
  }

  const {
    company_name, slug,
    admin_email, admin_password, admin_full_name,
    company_email, company_phone, company_address,
    gst_number, country,
  } = req.body;

  if (!company_name || !admin_email || !admin_password || !admin_full_name) {
    return res.status(400).json({
      message: "company_name, admin_email, admin_password, and admin_full_name are required",
    });
  }

  const resolvedSlug = slug || buildTenantSlug(company_name);

  try {
    const result = await bootstrapTenant({
      companyName: company_name,
      slug: resolvedSlug,
      adminEmail: admin_email,
      adminPassword: admin_password,
      adminFullName: admin_full_name,
      companyEmail: company_email,
      companyPhone: company_phone,
      companyAddress: company_address,
      gstNumber: gst_number,
      country,
      onboardedBy: req.user!.id,
    });

    res.status(201).json({
      message: "Company onboarded successfully",
      tenant_id: result.tenantId,
      admin_user_id: result.userId,
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({
        message: "A company with this slug or admin email already exists",
      });
    }
    console.error("[onboardCompany] error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** GET /v1/tenants — ZorTech super_admin: list all tenants with subscription status */
export const listTenants = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "super_admin" || req.user.tenant_id !== PLATFORM_TENANT_ID) {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    const result = await pool.query(
      `SELECT
         t.id, t.name, t.slug, t.is_platform_owner,
         t.company_email, t.company_phone, t.country,
         t.is_active, t.onboarded_at, t.created_at,
         s.status    AS subscription_status,
         s.plan_type,
         s.trial_ends_at,
         s.end_date  AS subscription_end_date
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       ORDER BY t.is_platform_owner DESC, t.created_at ASC`,
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[listTenants] error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** GET /v1/tenants/:id — get single tenant details */
export const getTenant = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "super_admin" || req.user.tenant_id !== PLATFORM_TENANT_ID) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         t.*,
         s.status       AS subscription_status,
         s.plan_type,
         s.billing_cycle,
         s.trial_ends_at,
         s.start_date   AS sub_start_date,
         s.end_date     AS sub_end_date
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       WHERE t.id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[getTenant] error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** POST /v1/tenants/bulk-delete — permanently delete one or more non-platform tenants */
export const bulkDeleteTenants = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "super_admin" || req.user.tenant_id !== PLATFORM_TENANT_ID) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids array is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const platformCheck = await client.query(
      "SELECT id FROM tenants WHERE id = ANY($1) AND is_platform_owner = true",
      [ids],
    );
    if (platformCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cannot delete the platform owner tenant" });
    }

    // Collect user IDs before cascade-deleting their memberships
    const userRows = await client.query(
      "SELECT DISTINCT user_id FROM tenant_memberships WHERE tenant_id = ANY($1)",
      [ids],
    );
    const userIds = userRows.rows.map((r: any) => r.user_id);

    // Deleting tenants cascades to tenant_memberships, clients, jobs, etc.
    const result = await client.query(
      "DELETE FROM tenants WHERE id = ANY($1) AND is_platform_owner = false RETURNING id",
      [ids],
    );

    // Remove orphan users (no remaining memberships after tenant deletion)
    if (userIds.length > 0) {
      await client.query(
        `DELETE FROM users WHERE id = ANY($1::uuid[])
         AND NOT EXISTS (SELECT 1 FROM tenant_memberships WHERE user_id = users.id)`,
        [userIds],
      );
    }

    await client.query("COMMIT");
    res.json({ deleted: result.rows.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[bulkDeleteTenants] error:", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

/** PATCH /v1/tenants/:id/status — activate or deactivate a tenant */
export const setTenantStatus = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "super_admin" || req.user.tenant_id !== PLATFORM_TENANT_ID) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const { id } = req.params;
  const { is_active } = req.body;
  if (typeof is_active !== "boolean") {
    return res.status(400).json({ message: "is_active (boolean) is required" });
  }
  try {
    const result = await pool.query(
      `UPDATE tenants SET is_active = $1, updated_at = now()
       WHERE id = $2 AND is_platform_owner = false
       RETURNING id, name, is_active`,
      [is_active, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Tenant not found or cannot modify platform owner" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[setTenantStatus] error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
