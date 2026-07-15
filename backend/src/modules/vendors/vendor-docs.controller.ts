import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import path from "path";

export const listVendorDocs = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { vendorId } = req.params;
  try {
    const result = await pool.query(
      `SELECT vd.*, u.first_name || ' ' || u.last_name as uploaded_by_name,
              CASE WHEN vd.expiry_date IS NOT NULL
                   THEN (vd.expiry_date::date - CURRENT_DATE)
                   ELSE NULL END as days_until_expiry
       FROM vendor_documents vd
       LEFT JOIN users u ON u.id = vd.uploaded_by
       WHERE vd.vendor_id=$1 AND vd.tenant_id=$2
       ORDER BY vd.created_at DESC`,
      [vendorId, tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listVendorDocs error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const uploadVendorDoc = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const { vendorId } = req.params;
  const { document_type, expiry_date } = req.body;

  if (!req.file) return res.status(400).json({ message: 'File is required' });
  if (!document_type) return res.status(400).json({ message: 'document_type is required' });

  const validTypes = ['nda', 'service_agreement', 'insurance', 'other'];
  if (!validTypes.includes(document_type)) {
    return res.status(400).json({ message: 'document_type must be one of: ' + validTypes.join(', ') });
  }

  try {
    const vendor = await pool.query('SELECT id FROM vendors WHERE id=$1 AND tenant_id=$2', [vendorId, tenantId]);
    if (!vendor.rows[0]) return res.status(404).json({ message: 'Vendor not found' });

    const filePath = '/uploads/' + req.file.filename;
    const result = await pool.query(
      `INSERT INTO vendor_documents
         (tenant_id, vendor_id, document_type, file_name, file_path, expiry_date, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, vendorId, document_type, req.file.originalname, filePath, expiry_date || null, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('uploadVendorDoc error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteVendorDoc = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { vendorId, docId } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM vendor_documents WHERE id=$1 AND vendor_id=$2 AND tenant_id=$3 RETURNING id',
      [docId, vendorId, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('deleteVendorDoc error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateVendorDocStatus = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { vendorId, docId } = req.params;
  const { status } = req.body;
  const valid = ['active', 'expired', 'revoked'];
  if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  try {
    const result = await pool.query(
      'UPDATE vendor_documents SET status=$1, updated_at=now() WHERE id=$2 AND vendor_id=$3 AND tenant_id=$4 RETURNING *',
      [status, docId, vendorId, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Document not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateVendorDocStatus error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
