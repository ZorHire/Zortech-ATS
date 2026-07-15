import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const getNotifications = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  try {
    const result = await pool.query(
      `SELECT id, type, title, body, entity_type, entity_id, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [userId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const markRead = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE notifications SET read_at = now()
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [id, userId],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const markAllRead = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  try {
    await pool.query(
      `UPDATE notifications SET read_at = now()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createNotification = async (
  userId: string,
  type: "info" | "success" | "warning" | "error",
  title: string,
  body?: string,
  entityType?: string,
  entityId?: string,
): Promise<void> => {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, body ?? null, entityType ?? null, entityId ?? null],
  );
};
