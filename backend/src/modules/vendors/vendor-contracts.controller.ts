import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';

// GET /vendors/:id/contracts
export const listContracts = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `SELECT vc.*, u.full_name AS created_by_name
       FROM vendor_contracts vc
       LEFT JOIN users u ON u.id = vc.created_by
       WHERE vc.vendor_id = $1 AND vc.tenant_id = $2
       ORDER BY vc.created_at DESC`,
      [id, tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error('listContracts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /vendors/:id/contracts
export const createContract = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;
  const {
    contract_type, title, start_date, end_date,
    status, terms, value, currency, renewal_reminder_days, notes,
  } = req.body;

  if (!title || !start_date) {
    return res.status(400).json({ message: 'title and start_date are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO vendor_contracts
         (tenant_id, vendor_id, contract_type, title, start_date, end_date,
          status, terms, value, currency, renewal_reminder_days, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        tenantId, id,
        contract_type || 'msa', title, start_date,
        end_date || null, status || 'active', terms || null,
        value || null, currency || 'INR',
        renewal_reminder_days || 30, notes || null, userId,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('createContract error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /vendors/:id/contracts/:contractId
export const updateContract = async (req: AuthRequest, res: Response) => {
  const { id, contractId } = req.params;
  const tenantId = req.user!.tenant_id;
  const {
    contract_type, title, start_date, end_date,
    status, terms, value, currency, renewal_reminder_days, notes,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE vendor_contracts
       SET contract_type         = COALESCE($1, contract_type),
           title                 = COALESCE($2, title),
           start_date            = COALESCE($3, start_date),
           end_date              = $4,
           status                = COALESCE($5, status),
           terms                 = $6,
           value                 = $7,
           currency              = COALESCE($8, currency),
           renewal_reminder_days = COALESCE($9, renewal_reminder_days),
           notes                 = $10,
           updated_at            = now()
       WHERE id = $11 AND vendor_id = $12 AND tenant_id = $13
       RETURNING *`,
      [
        contract_type, title, start_date,
        end_date ?? null, status, terms ?? null,
        value ?? null, currency, renewal_reminder_days,
        notes ?? null, contractId, id, tenantId,
      ],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateContract error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /vendors/:id/contracts/:contractId
export const deleteContract = async (req: AuthRequest, res: Response) => {
  const { id, contractId } = req.params;
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `DELETE FROM vendor_contracts
       WHERE id = $1 AND vendor_id = $2 AND tenant_id = $3
       RETURNING id`,
      [contractId, id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    res.json({ message: 'Contract deleted' });
  } catch (error) {
    console.error('deleteContract error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
