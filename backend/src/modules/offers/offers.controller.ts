import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const getOfferStats = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE stage = 'offer_extended')::int  AS pending,
         COUNT(*) FILTER (WHERE stage = 'offer_accepted')::int  AS accepted,
         COUNT(*) FILTER (WHERE stage = 'offer_rejected')::int  AS declined,
         COUNT(*) FILTER (WHERE stage = 'joined')::int          AS placements
       FROM job_applications
       WHERE tenant_id = $1`,
      [tenantId],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("getOfferStats error:", err);
    res.status(500).json({ error: "Failed to fetch offer stats" });
  }
};

export const listOffers = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { stage, job_id, from, to } = req.query;

  const params: unknown[] = [tenantId];
  let idx = 2;
  const extra: string[] = [];

  if (stage) { extra.push(`ja.stage = $${idx++}`); params.push(stage); }
  if (job_id) { extra.push(`ja.job_id = $${idx++}`); params.push(job_id); }
  if (from) { extra.push(`ja.updated_at >= $${idx++}`); params.push(from); }
  if (to) { extra.push(`ja.updated_at <= $${idx++}`); params.push(to); }

  const where = extra.length ? `AND ${extra.join(" AND ")}` : "";

  const sql = `
    SELECT
      ja.id                AS application_id,
      ja.stage,
      ja.updated_at        AS stage_updated_at,
      ja.created_at        AS applied_at,
      ja.notes,
      c.id                 AS candidate_id,
      c.first_name,
      c.last_name,
      c.email              AS candidate_email,
      c.phone              AS candidate_phone,
      c.current_title,
      c.current_ctc,
      c.expected_ctc,
      c.notice_period_days,
      j.id                 AS job_id,
      j.title              AS job_title,
      j.location           AS job_location,
      j.employment_type,
      cl.id                AS client_id,
      cl.name              AS client_name
    FROM job_applications ja
    JOIN candidates  c  ON c.id  = ja.candidate_id
    JOIN jobs        j  ON j.id  = ja.job_id
    LEFT JOIN clients cl ON cl.id = j.client_id
    WHERE ja.tenant_id = $1
      AND ja.stage IN ('offer_extended','offer_accepted','offer_rejected')
      ${where}
    ORDER BY ja.updated_at DESC
  `;

  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("listOffers error:", err);
    res.status(500).json({ error: "Failed to fetch offers" });
  }
};

export const listPlacements = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { job_id, from, to } = req.query;

  const params: unknown[] = [tenantId];
  let idx = 2;
  const extra: string[] = [];

  if (job_id) { extra.push(`ja.job_id = $${idx++}`); params.push(job_id); }
  if (from) { extra.push(`ja.updated_at >= $${idx++}`); params.push(from); }
  if (to) { extra.push(`ja.updated_at <= $${idx++}`); params.push(to); }

  const where = extra.length ? `AND ${extra.join(" AND ")}` : "";

  const sql = `
    SELECT
      ja.id                AS application_id,
      ja.stage,
      ja.updated_at        AS placement_date,
      ja.created_at        AS applied_at,
      c.id                 AS candidate_id,
      c.first_name,
      c.last_name,
      c.email              AS candidate_email,
      c.phone              AS candidate_phone,
      c.current_title,
      c.current_ctc,
      c.expected_ctc,
      c.notice_period_days,
      j.id                 AS job_id,
      j.title              AS job_title,
      j.location           AS job_location,
      j.employment_type,
      cl.id                AS client_id,
      cl.name              AS client_name
    FROM job_applications ja
    JOIN candidates  c  ON c.id  = ja.candidate_id
    JOIN jobs        j  ON j.id  = ja.job_id
    LEFT JOIN clients cl ON cl.id = j.client_id
    WHERE ja.tenant_id = $1
      AND ja.stage IN ('offer_accepted','joined')
      ${where}
    ORDER BY ja.updated_at DESC
  `;

  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("listPlacements error:", err);
    res.status(500).json({ error: "Failed to fetch placements" });
  }
};

export const updateOfferStage = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { stage } = req.body;
  const validStages = ["offer_extended", "offer_accepted", "offer_rejected", "joined"];
  if (!stage || !validStages.includes(stage as string)) {
    return res.status(400).json({ message: "stage must be one of: " + validStages.join(", ") });
  }
  try {
    const result = await pool.query(
      `UPDATE job_applications SET stage = $1, updated_at = now()
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, stage, updated_at`,
      [stage, id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Application not found" });
    }
    res.json(result.rows[0]);

    if (stage === 'joined') {
      (async () => {
        try {
          const app = await pool.query(
            `SELECT ja.*, j.client_id, j.title as job_title, c.id as cand_id
             FROM job_applications ja
             JOIN jobs j ON j.id = ja.job_id
             JOIN candidates c ON c.id = ja.candidate_id
             WHERE ja.id = $1`,
            [id]
          );
          if (app.rows[0] && app.rows[0].client_id) {
            const a = app.rows[0];
            const invoiceNum = 'INV-' + Date.now().toString().slice(-8);
            await pool.query(
              `INSERT INTO invoices (tenant_id, client_id, job_id, candidate_id, application_id, invoice_number, status)
               VALUES ($1,$2,$3,$4,$5,$6,'draft')
               ON CONFLICT DO NOTHING`,
              [tenantId, a.client_id, a.job_id, a.cand_id, id, invoiceNum]
            );
          }
        } catch(e) { console.error('auto-invoice error:', e); }
      })();
    }
  } catch (err) {
    console.error("updateOfferStage error:", err);
    res.status(500).json({ error: "Failed to update offer stage" });
  }
};
