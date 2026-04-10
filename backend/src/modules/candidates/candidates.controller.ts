import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';

export const getCandidates = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const result = await pool.query(
      'SELECT * FROM candidates WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCandidateById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      'SELECT * FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get candidate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createCandidate = async (req: AuthRequest, res: Response) => {
  const { first_name, last_name, email, phone, current_title, current_company, experience_years, current_location, preferred_location, notice_period_days, current_ctc, expected_ctc, skills, summary, resume_url, source, gdpr_consent } = req.body;
  const createdBy = req.user?.id;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `INSERT INTO candidates (tenant_id, first_name, last_name, email, phone, current_title, current_company, experience_years, current_location, preferred_location, notice_period_days, current_ctc, expected_ctc, skills, summary, resume_url, source, gdpr_consent, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [tenantId, first_name, last_name, email, phone, current_title, current_company, experience_years || 0, current_location, preferred_location, notice_period_days || 30, current_ctc, expected_ctc, skills || [], summary, resume_url, source || 'direct', gdpr_consent || false, createdBy]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create candidate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateCandidate = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { first_name, last_name, email, phone, current_title, current_company, experience_years, current_location, preferred_location, notice_period_days, current_ctc, expected_ctc, skills, summary, resume_url, source, is_active } = req.body;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `UPDATE candidates SET 
       first_name = COALESCE($1, first_name),
       last_name = COALESCE($2, last_name),
       email = COALESCE($3, email),
       phone = COALESCE($4, phone),
       current_title = COALESCE($5, current_title),
       current_company = COALESCE($6, current_company),
       experience_years = COALESCE($7, experience_years),
       current_location = COALESCE($8, current_location),
       preferred_location = COALESCE($9, preferred_location),
       notice_period_days = COALESCE($10, notice_period_days),
       current_ctc = COALESCE($11, current_ctc),
       expected_ctc = COALESCE($12, expected_ctc),
       skills = COALESCE($13, skills),
       summary = COALESCE($14, summary),
       resume_url = COALESCE($15, resume_url),
       source = COALESCE($16, source),
       is_active = COALESCE($17, is_active),
       updated_at = now()
       WHERE id = $18 AND tenant_id = $19 AND deleted_at IS NULL
       RETURNING *`,
      [first_name, last_name, email, phone, current_title, current_company, experience_years, current_location, preferred_location, notice_period_days, current_ctc, expected_ctc, skills, summary, resume_url, source, is_active, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update candidate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteCandidate = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      'UPDATE candidates SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};