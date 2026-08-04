import { Router, Request, Response, NextFunction } from "express";
import ledgerPool from "./ledger.db";
import env from "../../config/env";

const router = Router();

function apiKeyGuard(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-ledger-key"];
  if (!env.LEDGER_API_KEY || key !== env.LEDGER_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(apiKeyGuard);

router.get("/:key", async (req: Request, res: Response): Promise<void> => {
  const { key } = req.params;
  const result = await ledgerPool.query(
    "SELECT key, value FROM ledger_kv WHERE key = $1",
    [key]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ key, value: null });
    return;
  }
  res.json(result.rows[0]);
});

router.put("/:key", async (req: Request, res: Response): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body as { value: string };
  if (typeof value !== "string") {
    res.status(400).json({ error: "value must be a string" });
    return;
  }
  await ledgerPool.query(
    `INSERT INTO ledger_kv (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
  res.json({ key, value });
});

export default router;
