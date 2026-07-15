import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const createInvoice = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { client_id, job_id, candidate_id, amount, due_date, notes, currency } = req.body;

  if (!client_id) {
    return res.status(400).json({ message: "client_id is required" });
  }

  try {
    const invoiceNum = `INV-${Date.now().toString().slice(-8)}`;
    const result = await pool.query(
      `INSERT INTO invoices
         (tenant_id, client_id, job_id, candidate_id, invoice_number,
          amount, currency, due_date, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
       RETURNING *`,
      [
        tenantId,
        client_id,
        job_id || null,
        candidate_id || null,
        invoiceNum,
        amount != null ? Number(amount) : null,
        currency || "INR",
        due_date || null,
        notes || null,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create invoice error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const listInvoices = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { status, client_id } = req.query;
  const conditions: string[] = ["i.tenant_id = $1"];
  const params: any[] = [tenantId];
  let idx = 2;
  if (status) { conditions.push(`i.status = $${idx++}`); params.push(status); }
  if (client_id) { conditions.push(`i.client_id = $${idx++}`); params.push(client_id); }

  try {
    const result = await pool.query(
      `SELECT i.*,
         cl.name AS client_name,
         j.title AS job_title,
         c.first_name || ' ' || c.last_name AS candidate_name
       FROM invoices i
       LEFT JOIN clients cl ON cl.id = i.client_id
       LEFT JOIN jobs j ON j.id = i.job_id
       LEFT JOIN candidates c ON c.id = i.candidate_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY i.created_at DESC`,
      params,
    );
    res.json(result.rows);
  } catch (error) {
    console.error("List invoices error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getInvoiceById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT i.*,
         cl.name AS client_name, cl.primary_contact_email AS client_email,
         cl.billing_model, cl.invoice_cycle, cl.payment_terms,
         j.title AS job_title,
         c.first_name || ' ' || c.last_name AS candidate_name
       FROM invoices i
       LEFT JOIN clients cl ON cl.id = i.client_id
       LEFT JOIN jobs j ON j.id = i.job_id
       LEFT JOIN candidates c ON c.id = i.candidate_id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get invoice error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateInvoice = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  const { status, amount, due_date, notes } = req.body;
  const validStatuses = ["draft", "sent", "paid", "cancelled"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const result = await pool.query(
      `UPDATE invoices SET
         status     = COALESCE($1, status),
         amount     = COALESCE($2, amount),
         due_date   = COALESCE($3, due_date),
         notes      = COALESCE($4, notes),
         updated_at = now()
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [status, amount, due_date, notes, id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update invoice error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
