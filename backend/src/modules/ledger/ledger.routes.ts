import { Router, Request, Response } from "express";
import ledgerPool from "./ledger.db";
import { authMiddleware, authorize } from "../../middleware/auth";

const router = Router();

const MAX_KEY_LEN = 500;
const MAX_VAL_LEN = 1_000_000; // 1 MB text cap

/**
 * Authentication: a normal ATS session (JWT), restricted to finance roles.
 *
 * This replaces the previous static `x-ledger-key` header guard. That key had to
 * be embedded in ledger.html, which is served publicly from frontend/public — so
 * anyone who opened the page could read it from view-source and then read or
 * overwrite payroll, salaries and bank details. The key that was shipped that way
 * must be treated as compromised; it is no longer accepted.
 */
router.use(authMiddleware, authorize(["super_admin", "accounts_manager"]));

router.get("/:key", async (req: Request, res: Response): Promise<void> => {
  const { key } = req.params;
  if (key.length > MAX_KEY_LEN) {
    res.status(400).json({ error: "key too long" });
    return;
  }
  try {
    const result = await ledgerPool.query(
      "SELECT key, value FROM ledger_kv WHERE key = $1",
      [key]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ key, value: null });
      return;
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Ledger GET error:", err.message);
    res.status(503).json({ error: "Ledger database unavailable" });
  }
});

router.put("/:key", async (req: Request, res: Response): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body as { value: string };
  if (key.length > MAX_KEY_LEN) {
    res.status(400).json({ error: "key too long" });
    return;
  }
  if (typeof value !== "string") {
    res.status(400).json({ error: "value must be a string" });
    return;
  }
  if (value.length > MAX_VAL_LEN) {
    res.status(400).json({ error: "value exceeds maximum allowed size" });
    return;
  }
  try {
    await ledgerPool.query(
      `INSERT INTO ledger_kv (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
    res.json({ key, value });
  } catch (err: any) {
    console.error("Ledger PUT error:", err.message);
    res.status(503).json({ error: "Ledger database unavailable" });
  }
});

export default router;
