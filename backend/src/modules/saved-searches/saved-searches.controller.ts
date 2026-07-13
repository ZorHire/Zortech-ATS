import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const listSavedSearches = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT * FROM saved_searches WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [userId, tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("List saved searches error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createSavedSearch = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const tenantId = req.user?.tenant_id;
  const { name, query, email_alerts } = req.body;

  if (!name || !query) {
    return res.status(400).json({ message: "name and query are required" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO saved_searches (tenant_id, user_id, name, query, email_alerts)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, userId, name.trim(), JSON.stringify(query), email_alerts ?? false],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create saved search error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteSavedSearch = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;
  try {
    const result = await pool.query(
      `DELETE FROM saved_searches WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Saved search not found" });
    }
    res.json({ message: "Saved search deleted" });
  } catch (error) {
    console.error("Delete saved search error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
