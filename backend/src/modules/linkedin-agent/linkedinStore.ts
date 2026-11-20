import crypto from "crypto";
import { NextFunction, Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

/**
 * Shared state for the LinkedIn agent: extension tokens, the LinkedIn account seen by
 * the extension, the action log, and the sending limits.
 *
 * Limits are deliberately below LinkedIn's own (about 100 invitations a week for most
 * accounts) so recruiters' accounts stay in good standing.
 */
export const WEEKLY_INVITE_CAP = 100;
export const DAILY_INVITE_CAP_PER_USER = 40;
export const TOKEN_PREFIX = "zhli_";

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const newToken = () => TOKEN_PREFIX + crypto.randomBytes(24).toString("base64url");

export interface ExtRequest extends AuthRequest {
  ext?: { tokenId: string; userId: string; tenantId: string };
}

/** Authenticates the Chrome extension by its connection token (never a JWT, never a LinkedIn credential). */
export async function extAuth(req: ExtRequest, res: Response, next: NextFunction) {
  const raw = req.headers.authorization?.split(" ")[1] ?? "";
  if (!raw.startsWith(TOKEN_PREFIX)) return res.status(401).json({ message: "Connect the extension with a code from ZorHire" });
  try {
    const r = await pool.query(
      `UPDATE linkedin_ext_tokens t SET last_used_at = now()
         FROM users u, tenant_memberships m
        WHERE t.token_hash = $1 AND t.revoked_at IS NULL
          AND u.id = t.user_id AND u.is_active
          AND m.user_id = t.user_id AND m.tenant_id = t.tenant_id AND m.is_active
          AND m.role IN ('super_admin','accounts_manager','recruiter','vendor_manager')
        RETURNING t.id, t.user_id, t.tenant_id, m.role, u.email`,
      [hashToken(raw)],
    );
    const t = r.rows[0];
    if (!t) return res.status(401).json({ message: "This connection was removed. Reconnect the extension from ZorHire." });
    req.ext = { tokenId: t.id, userId: t.user_id, tenantId: t.tenant_id };
    req.user = { id: t.user_id, tenant_id: t.tenant_id, role: t.role, email: t.email };
    next();
  } catch (err) {
    console.error("extAuth error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function logAction(a: {
  tenantId: string;
  userId: string;
  kind: string;
  campaignId?: string | null;
  prospectId?: string | null;
  detail?: string | null;
}) {
  await pool.query(
    `INSERT INTO linkedin_actions (tenant_id, user_id, campaign_id, prospect_id, kind, detail) VALUES ($1,$2,$3,$4,$5,$6)`,
    [a.tenantId, a.userId, a.campaignId ?? null, a.prospectId ?? null, a.kind, a.detail ?? null],
  );
}

export async function inviteCounts(tenantId: string, userId: string) {
  const r = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')::int AS today
       FROM linkedin_actions
      WHERE tenant_id = $1 AND user_id = $2 AND kind = 'invite_sent' AND created_at >= now() - interval '7 days'`,
    [tenantId, userId],
  );
  return { week: r.rows[0]?.week ?? 0, today: r.rows[0]?.today ?? 0 };
}

export async function getAccount(tenantId: string, userId: string) {
  const r = await pool.query(`SELECT * FROM linkedin_accounts WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
  const a = r.rows[0];
  const tokens = await pool.query(
    `SELECT id, label, created_at, last_used_at FROM linkedin_ext_tokens
      WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL ORDER BY created_at DESC`,
    [tenantId, userId],
  );
  const counts = await inviteCounts(tenantId, userId);
  const online = !!a && Date.now() - new Date(a.last_seen_at).getTime() < 5 * 60 * 1000;
  return {
    connected: tokens.rows.length > 0,
    extension_online: online,
    tokens: tokens.rows,
    linkedin: a
      ? {
          name: a.li_name,
          public_id: a.li_public_id,
          headline: a.li_headline,
          has_premium: a.has_premium,
          recruiter_lite_detected: a.recruiter_lite_detected,
          recruiter_lite_override: a.recruiter_lite_override,
          recruiter_lite: a.recruiter_lite_override ?? a.recruiter_lite_detected,
          ext_version: a.ext_version,
          last_seen_at: a.last_seen_at,
          paused_reason: a.paused_until && new Date(a.paused_until) > new Date() ? a.paused_reason : null,
          paused_until: a.paused_until && new Date(a.paused_until) > new Date() ? a.paused_until : null,
        }
      : null,
    limits: {
      weekly_cap: WEEKLY_INVITE_CAP,
      daily_cap: DAILY_INVITE_CAP_PER_USER,
      sent_this_week: counts.week,
      sent_today: counts.today,
    },
  };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
