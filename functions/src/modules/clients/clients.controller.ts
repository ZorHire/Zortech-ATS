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
  const b = req.body;
  const createdBy = req.user?.id;
  const tenantId = req.user?.tenant_id;

  // frontend sends client_name; support both
  const name = b.name || b.client_name;
  if (!name?.trim()) {
    return res.status(400).json({ message: "Client name is required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO clients (
        tenant_id, name, client_type, industry, company_size, tier, website, linkedin,
        headquarters_location, operating_locations, address, city, country,
        primary_contact_name, primary_contact_email, primary_contact_phone, alternate_contact,
        engagement_type, hiring_volume, active_requirements, client_priority,
        sla, working_hours, billing_model, currency, markup, payment_terms,
        invoice_cycle, billing_contact, contract_start, contract_end,
        msa_signed, nda_signed, preferred_skills, typical_roles,
        candidate_preference, hiring_strategy, interview_process, evaluation_criteria,
        positions_closed, avg_closure_time, interview_ratio, offer_acceptance_rate,
        preferred_channel, update_frequency, auto_report,
        account_manager, delivery_lead, recruiters, tags, notes, sla_hours, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,
        $39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53
      ) RETURNING *`,
      [
        tenantId, name, b.client_type || null, b.industry || null, b.company_size || null,
        b.tier || "standard", b.website || null, b.linkedin || null,
        b.headquarters_location || null, b.operating_locations || [],
        b.address || null, b.city || null, b.country || "India",
        b.primary_contact_name || b.contact_name || null,
        b.primary_contact_email || null, b.primary_contact_phone || null,
        b.alternate_contact || null,
        b.engagement_type || null, b.hiring_volume || null, b.active_requirements || 0,
        b.client_priority || null, b.sla || null, b.working_hours || null,
        b.billing_model || null, b.currency || "INR", b.markup || null,
        b.payment_terms || null, b.invoice_cycle || null, b.billing_contact || null,
        b.contract_start || null, b.contract_end || null,
        b.msa_signed ?? false, b.nda_signed ?? false,
        b.preferred_skills || [], b.typical_roles || [],
        b.candidate_preference || null, b.hiring_strategy || null,
        b.interview_process || null, b.evaluation_criteria || null,
        b.positions_closed || 0, b.avg_closure_time || null,
        b.interview_ratio || null, b.offer_acceptance_rate || null,
        b.preferred_channel || null, b.update_frequency || null,
        b.auto_report ?? false, b.account_manager || null,
        b.delivery_lead || null, b.recruiters || [], b.tags || [],
        b.notes || null, b.sla_hours || 48, createdBy,
      ],
    );

    const client = result.rows[0];

    // Insert stakeholders if provided
    const stakeholders: Array<{ name: string; role?: string; email?: string; phone?: string; timezone?: string }> = b.stakeholders || [];
    const validStakeholders = stakeholders.filter((s) => s.name?.trim());
    for (const s of validStakeholders) {
      await pool.query(
        `INSERT INTO client_stakeholders (client_id, tenant_id, name, role, email, phone, timezone)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [client.id, tenantId, s.name, s.role || null, s.email || null, s.phone || null, s.timezone || null],
      );
    }

    res.status(201).json(client);
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
