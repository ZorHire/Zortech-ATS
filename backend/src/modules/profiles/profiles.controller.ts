import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { invalidate } from "../../lib/cache";
import { resolveStoredUpload } from "../../lib/uploadPaths";

export const getProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  try {
    const result = await pool.query(
      `SELECT p.id, p.full_name, p.email, p.avatar_url, p.phone, p.department,
              p.created_at, m.role, t.name AS tenant_name
       FROM profiles p
       JOIN tenant_memberships m ON m.user_id = p.id AND m.is_active = true
       JOIN tenants t ON t.id = m.tenant_id
       WHERE p.id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("getProfile error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { full_name, phone, avatar_url, department } = req.body;
  try {
    await pool.query(
      `UPDATE profiles SET
         full_name  = $1,
         phone      = $2,
         avatar_url = $3,
         department = $4,
         updated_at = now()
       WHERE id = $5`,
      [full_name ?? null, phone ?? null, avatar_url ?? null, department ?? null, userId]
    );
    await invalidate(`user:${userId}:me`);
    const result = await pool.query(
      `SELECT id, full_name, email, avatar_url, phone, department FROM profiles WHERE id = $1`,
      [userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  // Stored as "/uploads/avatars/<file>"; served only via GET /v1/profile/avatar/:userId.
  const avatarUrl = '/uploads/avatars/' + req.file.filename;
  try {
    // Avatars live on profiles (users has no avatar_url / tenant_id column, so the
    // previous UPDATE users ... always failed and no avatar could ever be saved).
    const result = await pool.query(
      'UPDATE profiles SET avatar_url=$1, updated_at=now() WHERE id=$2 RETURNING id',
      [avatarUrl, userId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Profile not found' });
    await invalidate(`user:${userId}:me`);
    res.json({ avatar_url: avatarUrl });
  } catch (err) {
    console.error('uploadAvatar error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /v1/profile/avatar/:userId ("me" for yourself)
 * Streams a user's avatar only if that user belongs to the caller's tenant.
 */
export const getAvatar = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const param = String(req.params.userId ?? '');
  const userId = param === 'me' ? req.user?.id : param;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return res.status(404).json({ message: 'Not found' });
  try {
    const result = await pool.query(
      `SELECT p.avatar_url
         FROM profiles p
         JOIN tenant_memberships m ON m.user_id = p.id AND m.tenant_id = $2 AND m.is_active = true
        WHERE p.id = $1`,
      [userId, tenantId]
    );
    const filePath = resolveStoredUpload(result.rows[0]?.avatar_url);
    if (!filePath) return res.status(404).json({ message: 'No avatar' });
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(filePath);
  } catch (err) {
    console.error('getAvatar error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

