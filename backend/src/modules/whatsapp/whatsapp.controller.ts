import crypto from "crypto";
import express, { Request, Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { decrypt, encrypt } from "../email/email.controller";

/**
 * WhatsApp for candidate messages (docs/whatsapp.md).
 *
 * Every recruiter sets their own number (PUT /whatsapp/me):
 *  - "click": works with any WhatsApp or WhatsApp Business number. ZorHire logs the
 *    message and returns a wa.me link; WhatsApp opens with the text filled in and the
 *    recruiter presses Send from their own number. No setup, no Meta account needed.
 *  - "api": automatic sending through the company's WhatsApp Business Platform (Cloud API)
 *    account, using the recruiter's number registered there. Replies and delivery/read
 *    receipts come back through the webhook.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res: Response, where: string, err: unknown) => {
  console.error(`whatsapp ${where} error:`, err);
  res.status(500).json({ message: "Internal server error" });
};

/** Normalise to E.164 digits (no "+"). 10-digit numbers are taken as Indian (+91). */
export function toE164Digits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
  else if (d.length === 10) d = "91" + d;
  return /^\d{10,15}$/.test(d) ? d : null;
}
const last10 = (d: string) => d.slice(-10);

async function companyConfig(tenantId: string) {
  const r = await pool.query(`SELECT * FROM tenant_whatsapp_config WHERE tenant_id = $1`, [tenantId]);
  const c = r.rows[0];
  if (!c) return null;
  try {
    return { ...c, access_token: decrypt(c.access_token_enc), app_secret: decrypt(c.app_secret_enc) };
  } catch {
    return { ...c, access_token: null, app_secret: null, corrupted: true };
  }
}

async function graph(token: string, path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message || `WhatsApp API error ${res.status}`) as Error & { status?: number; code?: number };
    e.status = res.status;
    e.code = data?.error?.code;
    throw e;
  }
  return data;
}

/* ───────────────────────────── My number ───────────────────────────── */

export const getMine = async (req: AuthRequest, res: Response) => {
  try {
    const { tenant_id: tenantId, id: userId } = req.user!;
    const r = await pool.query(`SELECT phone_e164, mode, phone_number_id, updated_at FROM user_whatsapp WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
    const company = await companyConfig(tenantId);
    res.json({ number: r.rows[0] ?? null, company_api: !!company && !company.corrupted });
  } catch (err) { fail(res, "getMine", err); }
};

/** PUT /whatsapp/me { phone, mode: click|api, phone_number_id? } */
export const saveMine = async (req: AuthRequest, res: Response) => {
  try {
    const { tenant_id: tenantId, id: userId } = req.user!;
    const phone = toE164Digits(req.body?.phone);
    if (!phone) return res.status(400).json({ message: "Enter your WhatsApp number with country code, e.g. +91 98765 43210." });
    const mode = req.body?.mode === "api" ? "api" : "click";
    let phoneNumberId: string | null = null;
    if (mode === "api") {
      const company = await companyConfig(tenantId);
      if (!company || company.corrupted) return res.status(400).json({ message: "Your company hasn't connected WhatsApp Business yet. Use click-to-send, or ask an admin to connect it." });
      // Find this number among the numbers registered on the company's WhatsApp Business account.
      const list = await graph(company.access_token, `/${encodeURIComponent(company.waba_id)}/phone_numbers?fields=id,display_phone_number,verified_name`);
      const match = (list.data ?? []).find((n: any) => last10(toE164Digits(n.display_phone_number) ?? "") === last10(phone));
      if (!match) return res.status(400).json({ message: "This number isn't registered on your company's WhatsApp Business account. An admin can add it in Meta's WhatsApp Manager, or use click-to-send." });
      phoneNumberId = String(match.id);
      const taken = await pool.query(`SELECT user_id FROM user_whatsapp WHERE phone_number_id = $1 AND NOT (tenant_id = $2 AND user_id = $3)`, [phoneNumberId, tenantId, userId]);
      if (taken.rows[0]) return res.status(409).json({ message: "Another recruiter is already sending from this number." });
    }
    await pool.query(
      `INSERT INTO user_whatsapp (tenant_id, user_id, phone_e164, mode, phone_number_id) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164, mode = EXCLUDED.mode,
         phone_number_id = EXCLUDED.phone_number_id, updated_at = now()`,
      [tenantId, userId, phone, mode, phoneNumberId],
    );
    res.json({ number: { phone_e164: phone, mode, phone_number_id: phoneNumberId } });
  } catch (err: any) {
    if (err?.status) return res.status(502).json({ message: `WhatsApp said: ${err.message}` });
    fail(res, "saveMine", err);
  }
};

export const removeMine = async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`DELETE FROM user_whatsapp WHERE tenant_id = $1 AND user_id = $2`, [req.user!.tenant_id, req.user!.id]);
    res.json({ ok: true });
  } catch (err) { fail(res, "removeMine", err); }
};

/* ───────────────────────────── Company (admins) ───────────────────────────── */

const webhookUrl = (req: Request) => `${req.protocol}://${req.get("host")}/v1/whatsapp/webhook`;

export const getCompany = async (req: AuthRequest, res: Response) => {
  try {
    const c = await companyConfig(req.user!.tenant_id);
    res.json(c ? {
      connected: !c.corrupted, waba_id: c.waba_id, template_name: c.template_name, template_lang: c.template_lang,
      verify_token: c.verify_token, webhook_url: webhookUrl(req), updated_at: c.updated_at, needs_reconnect: !!c.corrupted,
    } : { connected: false, webhook_url: webhookUrl(req) });
  } catch (err) { fail(res, "getCompany", err); }
};

/** PUT /whatsapp/company { waba_id, access_token, app_secret, template_name?, template_lang? } — checks the token first. */
export const saveCompany = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const b = req.body ?? {};
    const wabaId = typeof b.waba_id === "string" ? b.waba_id.trim() : "";
    if (!/^\d{5,25}$/.test(wabaId)) return res.status(400).json({ message: "Enter the WhatsApp Business Account ID (numbers only) from Meta's WhatsApp Manager." });
    const existing = await companyConfig(tenantId);
    const token = typeof b.access_token === "string" && b.access_token.trim() ? b.access_token.trim() : existing?.access_token;
    const secret = typeof b.app_secret === "string" && b.app_secret.trim() ? b.app_secret.trim() : existing?.app_secret;
    if (!token || !secret) return res.status(400).json({ message: "Enter the permanent access token and the app secret." });
    let numbers: any[] = [];
    try {
      numbers = (await graph(token, `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`)).data ?? [];
    } catch (e: any) {
      return res.status(400).json({ message: `WhatsApp didn't accept these details: ${e.message}` });
    }
    const templateName = typeof b.template_name === "string" && /^[a-z0-9_]{1,512}$/.test(b.template_name.trim()) ? b.template_name.trim() : null;
    const templateLang = typeof b.template_lang === "string" && /^[a-z]{2}(_[A-Z]{2})?$/.test(b.template_lang.trim()) ? b.template_lang.trim() : "en";
    const verifyToken = existing?.verify_token ?? crypto.randomBytes(18).toString("base64url");
    await pool.query(
      `INSERT INTO tenant_whatsapp_config (tenant_id, waba_id, access_token_enc, app_secret_enc, verify_token, template_name, template_lang, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id) DO UPDATE SET waba_id = EXCLUDED.waba_id, access_token_enc = EXCLUDED.access_token_enc,
         app_secret_enc = EXCLUDED.app_secret_enc, template_name = EXCLUDED.template_name, template_lang = EXCLUDED.template_lang,
         updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [tenantId, wabaId, encrypt(token), encrypt(secret), verifyToken, templateName, templateLang, req.user!.id],
    );
    res.json({
      connected: true, waba_id: wabaId, template_name: templateName, template_lang: templateLang, verify_token: verifyToken, webhook_url: webhookUrl(req),
      numbers: numbers.map((n) => ({ id: n.id, number: n.display_phone_number, name: n.verified_name, quality: n.quality_rating })),
    });
  } catch (err) { fail(res, "saveCompany", err); }
};

export const removeCompany = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    await pool.query(`DELETE FROM tenant_whatsapp_config WHERE tenant_id = $1`, [tenantId]);
    // Recruiters on automatic sending fall back to click-to-send.
    await pool.query(`UPDATE user_whatsapp SET mode = 'click', phone_number_id = NULL, updated_at = now() WHERE tenant_id = $1`, [tenantId]);
    res.json({ ok: true });
  } catch (err) { fail(res, "removeCompany", err); }
};

/* ───────────────────────────── Messages ───────────────────────────── */

async function candidateFor(tenantId: string, id: string) {
  if (!UUID_RE.test(id)) return null;
  const r = await pool.query(`SELECT id, first_name, phone FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, tenantId]);
  return r.rows[0] ?? null;
}

export const listMessages = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const c = await candidateFor(tenantId, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Candidate not found" });
    const r = await pool.query(
      `SELECT m.id, m.direction, m.mode, m.body, m.template, m.status, m.error, m.from_number, m.to_number, m.created_at, m.status_at,
              NULLIF(TRIM(p.full_name), '') AS sender_name
         FROM whatsapp_messages m LEFT JOIN profiles p ON p.id = m.user_id
        WHERE m.tenant_id = $1 AND m.candidate_id = $2 ORDER BY m.created_at ASC LIMIT 300`,
      [tenantId, c.id],
    );
    const lastIn = [...r.rows].reverse().find((m) => m.direction === "in");
    const windowOpen = !!lastIn && Date.now() - new Date(lastIn.created_at).getTime() < 24 * 3600 * 1000;
    res.json({ messages: r.rows, candidate_phone: toE164Digits(c.phone), session_open: windowOpen });
  } catch (err) { fail(res, "listMessages", err); }
};

/** POST /whatsapp/candidates/:id/messages { text } */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { tenant_id: tenantId, id: userId } = req.user!;
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ message: "Write a message first." });
    if (text.length > 4000) return res.status(400).json({ message: "WhatsApp messages can be at most 4,000 characters." });
    const c = await candidateFor(tenantId, String(req.params.id));
    if (!c) return res.status(404).json({ message: "Candidate not found" });
    const to = toE164Digits(c.phone);
    if (!to) return res.status(400).json({ message: "This candidate has no valid phone number. Add one with the country code." });
    const mine = (await pool.query(`SELECT * FROM user_whatsapp WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId])).rows[0];
    if (!mine) return res.status(400).json({ message: "Set your WhatsApp number first (Settings → WhatsApp)." });

    if (mine.mode === "click" || !mine.phone_number_id) {
      const r = await pool.query(
        `INSERT INTO whatsapp_messages (tenant_id, candidate_id, user_id, direction, mode, body, status, from_number, to_number)
         VALUES ($1,$2,$3,'out','click',$4,'prepared',$5,$6) RETURNING id`,
        [tenantId, c.id, userId, text, mine.phone_e164, to],
      );
      return res.status(201).json({ mode: "click", id: r.rows[0].id, url: `https://wa.me/${to}?text=${encodeURIComponent(text)}` });
    }

    const company = await companyConfig(tenantId);
    if (!company || company.corrupted) return res.status(400).json({ message: "Company WhatsApp Business isn't connected any more. Switch to click-to-send in Settings → WhatsApp." });
    const lastIn = await pool.query(
      `SELECT created_at FROM whatsapp_messages WHERE tenant_id = $1 AND candidate_id = $2 AND direction = 'in' ORDER BY created_at DESC LIMIT 1`,
      [tenantId, c.id],
    );
    const sessionOpen = lastIn.rows[0] && Date.now() - new Date(lastIn.rows[0].created_at).getTime() < 24 * 3600 * 1000;
    // Outside WhatsApp's 24-hour customer-service window only approved templates may be sent.
    let payload: any;
    let template: string | null = null;
    if (sessionOpen) {
      payload = { messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: true } };
    } else {
      if (!company.template_name) return res.status(400).json({ message: "The candidate hasn't messaged in the last 24 hours, so WhatsApp only allows an approved template. Ask an admin to set one in Settings → WhatsApp, or use click-to-send." });
      template = company.template_name;
      // Template params can't contain newlines or long runs of spaces.
      const param = text.replace(/\s*\n+\s*/g, " · ").replace(/ {4,}/g, " ").slice(0, 1000);
      payload = {
        messaging_product: "whatsapp", to, type: "template",
        template: { name: template, language: { code: company.template_lang }, components: [{ type: "body", parameters: [{ type: "text", text: c.first_name || "there" }, { type: "text", text: param }] }] },
      };
    }
    try {
      const out = await graph(company.access_token, `/${mine.phone_number_id}/messages`, { method: "POST", body: payload });
      const waId = out?.messages?.[0]?.id ?? null;
      const r = await pool.query(
        `INSERT INTO whatsapp_messages (tenant_id, candidate_id, user_id, direction, mode, body, template, wa_message_id, status, from_number, to_number, status_at)
         VALUES ($1,$2,$3,'out','api',$4,$5,$6,'sent',$7,$8,now()) RETURNING id`,
        [tenantId, c.id, userId, text, template, waId, mine.phone_e164, to],
      );
      res.status(201).json({ mode: "api", id: r.rows[0].id, template });
    } catch (e: any) {
      await pool.query(
        `INSERT INTO whatsapp_messages (tenant_id, candidate_id, user_id, direction, mode, body, template, status, error, from_number, to_number)
         VALUES ($1,$2,$3,'out','api',$4,$5,'failed',$6,$7,$8)`,
        [tenantId, c.id, userId, text, template, String(e.message).slice(0, 300), mine.phone_e164, to],
      );
      res.status(502).json({ message: `WhatsApp didn't send it: ${e.message}` });
    }
  } catch (err) { fail(res, "sendMessage", err); }
};

/** POST /whatsapp/messages/:id/status { status: sent } — recruiter confirms a click-to-send message went out. */
export const confirmClickSent = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) return res.status(404).json({ message: "Not found" });
    const r = await pool.query(
      `UPDATE whatsapp_messages SET status = 'sent', status_at = now() WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND mode = 'click' AND status = 'prepared' RETURNING id`,
      [id, req.user!.tenant_id, req.user!.id],
    );
    res.json({ ok: !!r.rowCount });
  } catch (err) { fail(res, "confirmClickSent", err); }
};

/* ───────────────────────────── Webhook (Meta → ZorHire) ───────────────────────────── */

/** GET /whatsapp/webhook — Meta's subscription check. */
export const verifyWebhook = async (req: Request, res: Response) => {
  try {
    const mode = req.query["hub.mode"];
    const token = String(req.query["hub.verify_token"] ?? "");
    const challenge = String(req.query["hub.challenge"] ?? "");
    if (mode !== "subscribe" || !token) return res.sendStatus(403);
    const r = await pool.query(`SELECT 1 FROM tenant_whatsapp_config WHERE verify_token = $1`, [token]);
    if (!r.rows[0]) return res.sendStatus(403);
    res.type("text/plain").send(challenge);
  } catch (err) { fail(res, "verifyWebhook", err); }
};

const STATUS_RANK: Record<string, number> = { prepared: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

/** POST /whatsapp/webhook — raw body (express.raw) so the signature can be checked. */
export const receiveWebhook = async (req: Request, res: Response) => {
  try {
    const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    let body: any;
    try { body = JSON.parse(raw.toString("utf8")); } catch { return res.sendStatus(400); }
    const sig = String(req.get("x-hub-signature-256") ?? "");
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const pnid = String(value?.metadata?.phone_number_id ?? "");
        if (!pnid) continue;
        const owner = (await pool.query(`SELECT tenant_id, user_id, phone_e164 FROM user_whatsapp WHERE phone_number_id = $1`, [pnid])).rows[0];
        if (!owner) continue;
        const company = await companyConfig(owner.tenant_id);
        if (!company?.app_secret) continue;
        // Only trust the payload if it's signed with this company's app secret.
        const expected = "sha256=" + crypto.createHmac("sha256", company.app_secret).update(raw).digest("hex");
        if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          console.warn("[whatsapp] webhook signature mismatch for tenant", owner.tenant_id);
          return res.sendStatus(401);
        }
        for (const m of value.messages ?? []) {
          const from = toE164Digits(m.from) ?? String(m.from ?? "");
          const text = m.type === "text" ? m.text?.body : m.type === "button" ? m.button?.text : m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title) : `[${m.type ?? "message"}]`;
          const cand = await pool.query(
            `SELECT id FROM candidates WHERE tenant_id = $1 AND deleted_at IS NULL AND RIGHT(regexp_replace(COALESCE(phone,''), '\\D', '', 'g'), 10) = $2
              ORDER BY updated_at DESC LIMIT 1`,
            [owner.tenant_id, last10(from)],
          );
          await pool.query(
            `INSERT INTO whatsapp_messages (tenant_id, candidate_id, user_id, direction, mode, body, wa_message_id, status, from_number, to_number, created_at)
             VALUES ($1,$2,$3,'in','api',$4,$5,'received',$6,$7, to_timestamp($8))
             ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING`,
            [owner.tenant_id, cand.rows[0]?.id ?? null, owner.user_id, String(text ?? "").slice(0, 4000), m.id ?? null, from, owner.phone_e164, Number(m.timestamp) || Date.now() / 1000],
          );
        }
        for (const s of value.statuses ?? []) {
          if (!s?.id || !(s.status in STATUS_RANK)) continue;
          await pool.query(
            `UPDATE whatsapp_messages SET status = $2, status_at = now(), error = COALESCE($3, error)
              WHERE wa_message_id = $1 AND tenant_id = $4
                AND (CASE status WHEN 'prepared' THEN 0 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 4 END) < $5`,
            [s.id, s.status, s.errors?.[0]?.title ?? null, owner.tenant_id, STATUS_RANK[s.status]],
          );
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("whatsapp webhook error:", err);
    res.sendStatus(200); // never make Meta retry forever on our bugs
  }
};

export const rawJson = express.raw({ type: "application/json", limit: "1mb" });
