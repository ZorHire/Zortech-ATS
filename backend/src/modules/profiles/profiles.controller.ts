import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { invalidate } from "../../lib/cache";

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
