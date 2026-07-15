import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const submitForApproval = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE jobs SET approval_status='pending_review', submitted_for_review_at=now(), updated_at=now()
       WHERE id=$1 AND tenant_id=$2 RETURNING id, title, approval_status`,
      [id, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('submitForApproval error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const approveJob = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const { id } = req.params;
  const { notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE jobs SET
         approval_status='approved', approved_by=$3, approved_at=now(),
         status='active', approval_notes=$4, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 RETURNING id, title, approval_status, status`,
      [id, tenantId, userId, notes || null]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('approveJob error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const rejectJob = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { notes } = req.body;
  if (!notes) return res.status(400).json({ message: 'Rejection notes are required' });
  try {
    const result = await pool.query(
      `UPDATE jobs SET approval_status='rejected', approval_notes=$3, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 RETURNING id, title, approval_status`,
      [id, tenantId, notes]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('rejectJob error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const listPendingApprovals = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT j.id, j.title, j.department, j.submitted_for_review_at,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM jobs j LEFT JOIN users u ON u.id = j.created_by
       WHERE j.tenant_id=$1 AND j.approval_status='pending_review'
       ORDER BY j.submitted_for_review_at ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listPendingApprovals error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
