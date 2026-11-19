import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import path from "path";
import fs from "fs";
import env from "../../config/env";

// Vendor documents live under <UPLOAD_DIR>/vendor-docs. Rows written before this
// change point at "/uploads/<name>" inside the old backend/uploads folder, so the
// download handler also looks there.
export const VENDOR_DOCS_DIR = path.resolve(env.UPLOAD_DIR, "vendor-docs");
const LEGACY_UPLOAD_DIR = path.resolve(__dirname, "../../../uploads");

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
  if (expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(expiry_date))) {
    return res.status(400).json({ message: 'expiry_date must be a date (YYYY-MM-DD)' });
  }

  try {
    const vendor = await pool.query('SELECT id FROM vendors WHERE id=$1 AND tenant_id=$2', [vendorId, tenantId]);
    if (!vendor.rows[0]) return res.status(404).json({ message: 'Vendor not found' });

    const filePath = '/uploads/vendor-docs/' + req.file.filename;
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

/** Streams a document to an authenticated user of the same tenant, with its original file name. */
export const downloadVendorDoc = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { vendorId, docId } = req.params;
  try {
    const result = await pool.query(
      'SELECT file_name, file_path FROM vendor_documents WHERE id=$1 AND vendor_id=$2 AND tenant_id=$3',
      [docId, vendorId, tenantId]
    );
    const doc = result.rows[0];
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const relative = String(doc.file_path || '').replace(/^\/uploads\//, '');
    const candidates = [
      path.resolve(env.UPLOAD_DIR, relative),
      path.resolve(LEGACY_UPLOAD_DIR, relative),
    ].filter((p) => p.startsWith(path.resolve(env.UPLOAD_DIR) + path.sep) || p.startsWith(LEGACY_UPLOAD_DIR + path.sep));
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) return res.status(404).json({ message: 'File is no longer available. Please upload it again.' });

    res.download(found, doc.file_name);
  } catch (err) {
    console.error('downloadVendorDoc error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
