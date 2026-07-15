import sgMail from "@sendgrid/mail";
import { EventWebhook } from "@sendgrid/eventwebhook";
import pool from "../../../db";

function initSendGrid() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY not configured");
  sgMail.setApiKey(key);
}

export async function sendEmailViaSendGrid(opts: {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<void> {
  initSendGrid();
  const fromEmail = opts.from || process.env.SENDGRID_FROM_EMAIL || "noreply@zorhire.com";

  await sgMail.send({
    to: opts.to,
    from: fromEmail,
    subject: opts.subject,
    html: opts.html,
    text: opts.text || opts.html.replace(/<[^>]+>/g, ""),
    replyTo: opts.replyTo,
  });
}

export async function sendBulkEmailViaSendGrid(messages: Array<{
  to: string;
  subject: string;
  html: string;
  customArgs?: Record<string, string>;
}>): Promise<void> {
  initSendGrid();
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@zorhire.com";

  const personalizations = messages.map((m) => ({
    to: [{ email: m.to }],
    subject: m.subject,
    customArgs: m.customArgs,
  }));

  await sgMail.send({
    personalizations,
    from: fromEmail,
    html: messages[0]?.html || "",
  } as any);
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
): boolean {
  try {
    const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
    if (!publicKey) return false;
    const ew = new EventWebhook();
    const ecPublicKey = ew.convertPublicKeyToECDSA(publicKey);
    return ew.verifySignature(ecPublicKey, Buffer.from(payload), signature, timestamp);
  } catch {
    return false;
  }
}

export async function handleBounceEvent(tenantId: string, email: string, reason: string) {
  await pool.query(
    `INSERT INTO email_bounces (tenant_id, email, reason, bounced_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (tenant_id, email) DO UPDATE SET reason=$3, bounced_at=NOW()`,
    [tenantId, email, reason],
  );
}

export async function handleUnsubscribeEvent(tenantId: string, email: string) {
  await pool.query(
    `INSERT INTO email_unsubscribes (tenant_id, email, unsubscribed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (tenant_id, email) DO NOTHING`,
    [tenantId, email],
  );
}
