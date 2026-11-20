/**
 * /v1/ai-usage: this month's AI allowance and usage for the signed-in company,
 * and (ZorTech staff only) extra actions granted to a company for the month.
 */
import { Response, Router } from "express";
import pool from "../../db";
import { AuthRequest, authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import { clearAllowanceCache, currentMonth, getAllowanceStatus, METERS, type Meter } from "../../services/aiAllowance";

const STAFF = ["super_admin", "accounts_manager", "vendor_manager", "recruiter"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const aiUsageRouter = Router();
aiUsageRouter.use(authMiddleware, tenantIsolation);

/** GET /v1/ai-usage */
aiUsageRouter.get("/", authorize(STAFF), async (req: AuthRequest, res: Response) => {
  try {
    res.json(await getAllowanceStatus(req.user!.tenant_id));
  } catch (err) {
    console.error("ai-usage status error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /v1/ai-usage/topups { tenant_id, meter, units, note? }
 * Adds actions to a company's allowance for the current month. Only a super admin of
 * ZorTech's own company (the platform owner) can do this, e.g. after a customer buys a pack.
 */
aiUsageRouter.post("/topups", authorize(["super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const owner = await pool.query(`SELECT is_platform_owner FROM tenants WHERE id = $1`, [req.user!.tenant_id]);
    if (!owner.rows[0]?.is_platform_owner) return res.status(403).json({ message: "Only ZorTech can add AI actions" });
    const { tenant_id, meter, units, note } = req.body ?? {};
    if (typeof tenant_id !== "string" || !UUID_RE.test(tenant_id)) return res.status(400).json({ message: "tenant_id is required" });
    if (!METERS.some((m) => m.key === meter)) return res.status(400).json({ message: `meter must be one of ${METERS.map((m) => m.key).join(", ")}` });
    const n = Number(units);
    if (!Number.isInteger(n) || n <= 0 || n > 100000) return res.status(400).json({ message: "units must be a whole number from 1 to 100000" });
    const t = await pool.query(`SELECT 1 FROM tenants WHERE id = $1`, [tenant_id]);
    if (!t.rows[0]) return res.status(404).json({ message: "Company not found" });
    await pool.query(
      `INSERT INTO ai_allowance_topups (tenant_id, meter, units, month, note, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenant_id, meter as Meter, n, currentMonth(), typeof note === "string" ? note.slice(0, 300) : null, req.user!.id],
    );
    // A top-up may lift a company back under its limit: let the 100% alert fire again if it runs out again.
    await pool.query(`DELETE FROM ai_usage_alerts WHERE tenant_id = $1 AND meter = $2 AND month = $3 AND level = 100`, [tenant_id, meter, currentMonth()]);
    await clearAllowanceCache(tenant_id);
    res.status(201).json(await getAllowanceStatus(tenant_id));
  } catch (err) {
    console.error("ai-usage topup error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
