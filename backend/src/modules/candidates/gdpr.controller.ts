import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const updateGdprConsent = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { consent } = req.body;
  if (typeof consent !== 'boolean') return res.status(400).json({ message: 'consent must be boolean' });
  try {
    const result = await pool.query(
      `UPDATE candidates SET
         gdpr_consent=$1,
         gdpr_consent_date=CASE WHEN $1 THEN now() ELSE NULL END,
         updated_at=now()
       WHERE id=$2 AND tenant_id=$3
       RETURNING id, gdpr_consent, gdpr_consent_date`,
      [consent, id, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Candidate not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateGdprConsent error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const requestDeletion = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE candidates SET deletion_requested_at=now(), updated_at=now()
       WHERE id=$1 AND tenant_id=$2 RETURNING id, deletion_requested_at`,
      [id, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Candidate not found' });
    res.json({ message: 'Deletion request recorded', ...result.rows[0] });
  } catch (err) {
    console.error('requestDeletion error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const anonymizeCandidate = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  try {
    const exists = await pool.query('SELECT id FROM candidates WHERE id=$1 AND tenant_id=$2', [id, tenantId]);
    if (!exists.rows[0]) return res.status(404).json({ message: 'Candidate not found' });

    // Anonymize PII fields
    await pool.query(
      `UPDATE candidates SET
         first_name='[Deleted]', last_name='', email=concat('deleted_', id, '@removed.invalid'),
         phone=NULL, resume_url=NULL, linkedin_url=NULL, current_location=NULL,
         gdpr_consent=false, deletion_requested_at=now(), updated_at=now()
       WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId]
    );
    res.json({ message: 'Candidate anonymized (GDPR right-to-forget applied)' });
  } catch (err) {
    console.error('anonymizeCandidate error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const listDeletionRequests = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, deletion_requested_at
       FROM candidates WHERE tenant_id=$1 AND deletion_requested_at IS NOT NULL
       ORDER BY deletion_requested_at ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listDeletionRequests error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
