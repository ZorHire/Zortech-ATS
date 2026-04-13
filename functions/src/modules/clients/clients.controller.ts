import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const getClients = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const result = await pool.query(
      "SELECT * FROM clients WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name ASC",
      [tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get clients error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getClientById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      "SELECT * FROM clients WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get client error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createClient = async (req: AuthRequest, res: Response) => {
  const {
    name, industry, tier, website, logo_url, address, city, country,
    primary_contact_name, primary_contact_email, primary_contact_phone, sla_hours,
  } = req.body;
  const createdBy = req.user?.id;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `INSERT INTO clients (tenant_id, name, industry, tier, website, logo_url, address, city, country, primary_contact_name, primary_contact_email, primary_contact_phone, sla_hours, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [tenantId, name, industry, tier || "standard", website, logo_url, address, city, country || "India", primary_contact_name, primary_contact_email, primary_contact_phone, sla_hours || 48, createdBy],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create client error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateClient = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    name, industry, tier, website, logo_url, address, city, country,
    primary_contact_name, primary_contact_email, primary_contact_phone, sla_hours, is_active,
  } = req.body;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `UPDATE clients SET
       name = COALESCE($1, name),
       industry = COALESCE($2, industry),
       tier = COALESCE($3, tier),
       website = COALESCE($4, website),
       logo_url = COALESCE($5, logo_url),
       address = COALESCE($6, address),
       city = COALESCE($7, city),
       country = COALESCE($8, country),
       primary_contact_name = COALESCE($9, primary_contact_name),
       primary_contact_email = COALESCE($10, primary_contact_email),
       primary_contact_phone = COALESCE($11, primary_contact_phone),
       sla_hours = COALESCE($12, sla_hours),
       is_active = COALESCE($13, is_active),
       updated_at = now()
       WHERE id = $14 AND tenant_id = $15 AND deleted_at IS NULL
       RETURNING *`,
      [name, industry, tier, website, logo_url, address, city, country, primary_contact_name, primary_contact_email, primary_contact_phone, sla_hours, is_active, id, tenantId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update client error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteClient = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      "UPDATE clients SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }
    res.json({ message: "Client deleted successfully" });
  } catch (error) {
    console.error("Delete client error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
