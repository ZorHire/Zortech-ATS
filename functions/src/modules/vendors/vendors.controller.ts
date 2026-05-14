import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getAtsPool } from "../../db/poolRouter";

export const getVendors = async (req: AuthRequest, res: Response) => {
  try {
    const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;
    const limitVal = Math.min(Number(req.query.limit) || 500, 500);
    const offsetVal = Math.max(Number(req.query.offset) || 0, 0);
    const db = await getAtsPool(filterTenantId);
    const result = await db.query(
      "SELECT * FROM vendors WHERE ($1::uuid IS NULL OR tenant_id = $1) AND deleted_at IS NULL ORDER BY company_name ASC LIMIT $2 OFFSET $3",
      [filterTenantId, limitVal, offsetVal],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get vendors error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getVendorById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;
  try {
    const db = await getAtsPool(filterTenantId);
    const result = await db.query(
      "SELECT * FROM vendors WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2) AND deleted_at IS NULL",
      [id, filterTenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get vendor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createVendor = async (req: AuthRequest, res: Response) => {
  const {
    company_name, registration_number, gst_id, primary_contact_name,
    primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier,
  } = req.body;
  const tenantId = req.user?.tenant_id;

  try {
    const db = await getAtsPool(tenantId);
    const result = await db.query(
      `INSERT INTO vendors (tenant_id, company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [tenantId, company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations || [], geographies || [], tier || "standard"],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create vendor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateVendor = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    company_name, registration_number, gst_id, primary_contact_name,
    primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier, is_active,
  } = req.body;
  const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;

  try {
    const db = await getAtsPool(filterTenantId);
    const result = await db.query(
      `UPDATE vendors SET
       company_name = COALESCE($1, company_name),
       registration_number = COALESCE($2, registration_number),
       gst_id = COALESCE($3, gst_id),
       primary_contact_name = COALESCE($4, primary_contact_name),
       primary_contact_email = COALESCE($5, primary_contact_email),
       primary_contact_phone = COALESCE($6, primary_contact_phone),
       industry_specializations = COALESCE($7, industry_specializations),
       geographies = COALESCE($8, geographies),
       tier = COALESCE($9, tier),
       is_active = COALESCE($10, is_active),
       updated_at = now()
       WHERE id = $11 AND ($12::uuid IS NULL OR tenant_id = $12) AND deleted_at IS NULL
       RETURNING *`,
      [company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier, is_active, id, filterTenantId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update vendor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteVendor = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;
  try {
    const db = await getAtsPool(filterTenantId);
    const result = await db.query(
      "UPDATE vendors SET deleted_at = now() WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2) RETURNING id",
      [id, filterTenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    res.json({ message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("Delete vendor error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
