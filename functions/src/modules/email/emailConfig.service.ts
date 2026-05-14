/**
 * Per-user email service.
 *
 * This module is the single abstraction layer between "send an email" and
 * "which SMTP credentials to use".  All controllers call sendEmailAsUser()
 * and never touch nodemailer directly.
 */

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import pool from "../../db";
import { decrypt } from "../../utils/encryption";
// ─── Domain-specific error codes ────────────────────────────────────────────

export type EmailErrorCode =
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_DECRYPT_FAILED"
  | "SMTP_AUTH_FAILED"
  | "SMTP_NOT_ENABLED"
  | "SMTP_LIMIT_REACHED"
  | "SMTP_SEND_FAILED";

export class EmailServiceError extends Error {
  constructor(
    message: string,
    public readonly code: EmailErrorCode,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "EmailServiceError";
  }
}

// ─── Public interface ────────────────────────────────────────────────────────

export interface SendEmailParams {
  userId: string;
  tenantId: string;
  /** Display name used in the From header, e.g. the recruiter's full name. */
  senderName?: string;
  to: string;
  subject: string;
  html: string;
}

// ─── Private helpers ─────────────────────────────────────────────────────────

interface ResolvedConfig {
  email: string;
  password: string;
  provider: string;
  /** Display name for the From header — set by tier-2 tenant config. */
  displayName?: string;
}

/**
 * Load the calling user's personal SMTP config (tier 1 only).
 * Used by verifySmtpConnection so "test my email" always tests the user's own config.
 */
async function loadAndDecryptConfig(
  userId: string,
  tenantId: string,
): Promise<ResolvedConfig> {
  const result = await pool.query<{
    email: string;
    encrypted_password: string;
    provider: string;
  }>(
    `SELECT email, encrypted_password, provider
       FROM user_email_config
      WHERE user_id = $1 AND tenant_id = $2 AND is_active = true
      LIMIT 1`,
    [userId, tenantId],
  );

  if (result.rows.length === 0) {
    throw new EmailServiceError(
      "Email not configured. Please connect your email first.",
      "EMAIL_NOT_CONFIGURED",
      400,
    );
  }

  const row = result.rows[0];

  let password: string;
  try {
    password = decrypt(row.encrypted_password);
  } catch (e) {
    // Most common cause: EMAIL_ENCRYPTION_KEY changed or not set in this environment.
    // Log details server-side but never expose the raw error to the client.
    console.error(
      "[email] Decryption failed for user",
      userId,
      "— check that SERVER_EMAIL_ENCRYPTION_KEY is set and matches the value used when the config was saved.",
      (e as Error).message,
    );
    throw new EmailServiceError(
      "Email credentials could not be decrypted. Please go to Email Settings and reconnect your email.",
      "EMAIL_DECRYPT_FAILED",
      400,
    );
  }

  return { email: row.email, password, provider: row.provider };
}


/**
 * Resolve the best available sending config: user SMTP → company SMTP → error.
 * Used exclusively by sendEmailAsUser so all email sends fall through tiers.
 */
async function resolveSendConfig(
  userId: string,
  tenantId: string,
): Promise<ResolvedConfig> {
  // ── Tier 1: per-user SMTP ────────────────────────────────────────────────
  const tier1 = await pool.query<{
    email: string;
    encrypted_password: string;
    provider: string;
  }>(
    `SELECT email, encrypted_password, provider
       FROM user_email_config
      WHERE user_id = $1 AND tenant_id = $2 AND is_active = true
      LIMIT 1`,
    [userId, tenantId],
  );

  if (tier1.rows.length > 0) {
    const row = tier1.rows[0];
    let password: string;
    try {
      password = decrypt(row.encrypted_password);
    } catch (e) {
      console.error(
        "[email] Tier-1 decryption failed for user", userId,
        "— check SERVER_EMAIL_ENCRYPTION_KEY.", (e as Error).message,
      );
      throw new EmailServiceError(
        "Email credentials could not be decrypted. Please go to Email Settings and reconnect your email.",
        "EMAIL_DECRYPT_FAILED",
        400,
      );
    }
    return { email: row.email, password, provider: row.provider };
  }

  // ── Tier 2: per-tenant SMTP ──────────────────────────────────────────────
  const tier2 = await pool.query<{
    email: string;
    encrypted_password: string;
    provider: string;
    display_name: string | null;
  }>(
    `SELECT email, encrypted_password, provider, display_name
       FROM tenant_email_config
      WHERE tenant_id = $1 AND is_active = true
      LIMIT 1`,
    [tenantId],
  );

  if (tier2.rows.length > 0) {
    const row = tier2.rows[0];
    let password: string;
    try {
      password = decrypt(row.encrypted_password);
    } catch (e) {
      console.error(
        "[email] Tier-2 decryption failed for tenant", tenantId,
        "— check SERVER_EMAIL_ENCRYPTION_KEY.", (e as Error).message,
      );
      throw new EmailServiceError(
        "Company email credentials could not be decrypted. Please ask your admin to reconnect the company email.",
        "EMAIL_DECRYPT_FAILED",
        400,
      );
    }
    return {
      email: row.email,
      password,
      provider: row.provider,
      displayName: row.display_name ?? undefined,
    };
  }

  // ── Tier 3: no config found ──────────────────────────────────────────────
  throw new EmailServiceError(
    "No email sender configured. Please set up SMTP credentials in Email Settings.",
    "EMAIL_NOT_CONFIGURED",
    400,
  );
}

// Timeout values for all SMTP connections (ms)
const SMTP_TIMEOUT = 15_000;

/** Build nodemailer SMTP options for the given provider. */
function buildTransporterOptions(
  provider: string,
  email: string,
  password: string,
): SMTPTransport.Options {
  const timeouts = {
    connectionTimeout: SMTP_TIMEOUT,
    greetingTimeout: SMTP_TIMEOUT,
    socketTimeout: SMTP_TIMEOUT,
  };

  if (provider === "zoho") {
    return {
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password },
      ...timeouts,
    };
  }

  // Zoho India datacenter — resolved automatically during save
  if (provider === "zoho_in") {
    return {
      host: "smtp.zoho.in",
      port: 465,
      secure: true,
      auth: { user: email, pass: password },
      ...timeouts,
    };
  }

  // Zoho India premium (Zoho Workplace) datacenter
  if (provider === "zoho_in_pro") {
    return {
      host: "smtppro.zoho.in",
      port: 465,
      secure: true,
      auth: { user: email, pass: password },
      ...timeouts,
    };
  }

  if (provider === "gmail" || provider === "google_workspace") {
    return {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: email, pass: password },
      ...timeouts,
    };
  }

  // Generic fallback — provider field stores the SMTP hostname
  return {
    host: provider,
    port: 587,
    secure: false,
    auth: { user: email, pass: password },
    ...timeouts,
  };
}

/**
 * Map a raw nodemailer SMTP error to a typed EmailServiceError.
 *
 * Nodemailer surfaces errors in multiple places:
 *   err.code       — category ('EAUTH', 'ESOCKET', 'ETIMEDOUT', …)
 *   err.responseCode — numeric SMTP code (535, 530, …)
 *   err.response   — raw SMTP response line
 *   err.message    — human-readable summary (may or may not contain the above)
 *
 * We check all four so a missed pattern in one field is caught by another.
 */
function mapSmtpError(err: any): never {
  const code: string = (err?.code ?? "").toUpperCase();
  const responseCode: number = err?.responseCode ?? 0;
  const msg: string = (err?.message ?? "").toLowerCase();
  const response: string = (err?.response ?? "").toLowerCase();
  const combined = `${msg} ${response}`;

  // Log the raw error server-side so deployments can be debugged
  console.error("[email] SMTP error:", {
    code: err?.code,
    responseCode,
    message: err?.message,
    response: err?.response,
  });

  // ── Authentication / credential failures ──────────────────────────────────
  if (
    code === "EAUTH" ||
    responseCode === 535 ||
    combined.includes("535") ||
    combined.includes("invalid login") ||
    combined.includes("username and password not accepted") ||
    combined.includes("authentication failed") ||
    combined.includes("auth credentials") ||
    combined.includes("bad credentials") ||
    (combined.includes("auth") && combined.includes("fail"))
  ) {
    throw new EmailServiceError(
      "SMTP authentication failed. Your Zoho app password is incorrect or expired. Please go to Email Settings and reconnect with a fresh app password.",
      "SMTP_AUTH_FAILED",
      400,
    );
  }

  // ── SMTP access disabled ──────────────────────────────────────────────────
  if (
    responseCode === 530 ||
    combined.includes("530") ||
    combined.includes("smtp access is not enabled") ||
    combined.includes("smtp not enabled") ||
    combined.includes("relay not permitted") ||
    combined.includes("access denied") ||
    combined.includes("not allowed to send")
  ) {
    throw new EmailServiceError(
      "SMTP access is disabled on your Zoho account. In Zoho Mail go to Settings → Security → enable SMTP access, then reconnect.",
      "SMTP_NOT_ENABLED",
      400,
    );
  }

  // ── Daily/quota limits ────────────────────────────────────────────────────
  if (
    responseCode === 452 ||
    combined.includes("452") ||
    combined.includes("daily user sending limit") ||
    combined.includes("sending limit") ||
    combined.includes("quota exceeded")
  ) {
    throw new EmailServiceError(
      "Email sending limit reached. Please try again later.",
      "SMTP_LIMIT_REACHED",
      429,
    );
  }

  // ── Unknown SMTP failure ──────────────────────────────────────────────────
  throw new EmailServiceError(
    "Failed to send email. Please try again.",
    "SMTP_SEND_FAILED",
    500,
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Send an email on behalf of a specific user using their saved SMTP config.
 *
 * A fresh nodemailer transporter is created per call — never shared globally —
 * so different users' credentials cannot leak across requests.
 *
 * @throws {EmailServiceError} with a discriminated `code` for all known failure modes.
 */
export async function sendEmailAsUser(params: SendEmailParams): Promise<void> {
  const { userId, tenantId, senderName, to, subject, html } = params;

  const config = await resolveSendConfig(userId, tenantId);
  const options = buildTransporterOptions(config.provider, config.email, config.password);
  const transporter = nodemailer.createTransport(options);

  // Priority: explicit senderName (recruiter) → tenant displayName → bare email
  const from = senderName
    ? `"${senderName}" <${config.email}>`
    : config.displayName
      ? `"${config.displayName}" <${config.email}>`
      : config.email;

  try {
    await transporter.sendMail({ from, to, subject, html });
  } catch (err: any) {
    mapSmtpError(err);
  }
}

/**
 * Verify raw (plaintext) SMTP credentials immediately — used in saveEmailConfig
 * to validate before storing.
 *
 * For Zoho, both smtp.zoho.com (global) and smtp.zoho.in (India) are tried in
 * PARALLEL.  Whichever succeeds first wins and its provider key is returned so
 * the caller persists the correct host.  Indian Zoho accounts often receive an
 * auth-looking error from smtp.zoho.com even with correct credentials; running
 * both in parallel avoids that false negative while keeping latency low.
 *
 * @returns The resolved provider string ("zoho", "zoho_in", "google_workspace", …)
 * @throws {EmailServiceError} only when ALL attempted hosts fail.
 */
export async function verifySmtpCredentials(
  email: string,
  password: string,
  provider: string,
): Promise<string> {
  if (provider === "zoho" || provider === "zoho_in" || provider === "zoho_in_pro") {
    const hosts: Array<{ host: string; resolvedProvider: string }> = [
      { host: "smtp.zoho.com",    resolvedProvider: "zoho" },
      { host: "smtp.zoho.in",     resolvedProvider: "zoho_in" },
      { host: "smtppro.zoho.in",  resolvedProvider: "zoho_in_pro" },
    ];

    // Race both datacenters in parallel — first success wins
    const settled = await Promise.allSettled(
      hosts.map(async ({ host, resolvedProvider }) => {
        const options: SMTPTransport.Options = {
          host,
          port: 465,
          secure: true,
          auth: { user: email, pass: password },
          connectionTimeout: SMTP_TIMEOUT,
          greetingTimeout: SMTP_TIMEOUT,
          socketTimeout: SMTP_TIMEOUT,
        };
        const transporter = nodemailer.createTransport(options);
        console.log(`[email] SMTP verify attempt for ${email} via ${host}`);
        await transporter.verify();
        console.log(`[email] SMTP verify succeeded via ${host}`);
        return resolvedProvider;
      }),
    );

    const winner = settled.find(
      (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled",
    );
    if (winner) return winner.value;

    // Both failed — surface the most informative error
    const errors = settled
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason);

    console.error("[email] All Zoho SMTP hosts failed:", errors.map((e) => e?.message));
    // Prefer auth errors over connection errors so the message is actionable
    const authErr = errors.find(
      (e) => (e?.code ?? "").toUpperCase() === "EAUTH" || (e?.responseCode ?? 0) === 535,
    );
    mapSmtpError(authErr ?? errors[0]);
  }

  // Non-Zoho providers — single attempt
  const options = buildTransporterOptions(provider, email, password);
  const transporter = nodemailer.createTransport(options);
  try {
    console.log(`[email] SMTP verify attempt for ${email} via ${provider}`);
    await transporter.verify();
    console.log(`[email] SMTP verify succeeded for ${provider}`);
  } catch (err: any) {
    mapSmtpError(err);
  }
  return provider;
}

/**
 * Verify the stored SMTP credentials for a user by opening an authenticated
 * connection without sending any email.  Used by the "Test Connection" feature.
 *
 * @throws {EmailServiceError} describing exactly what went wrong.
 */
export async function verifySmtpConnection(
  userId: string,
  tenantId: string,
): Promise<void> {
  const config = await loadAndDecryptConfig(userId, tenantId);
  const options = buildTransporterOptions(config.provider, config.email, config.password);
  const transporter = nodemailer.createTransport(options);

  try {
    await transporter.verify();
  } catch (err: any) {
    mapSmtpError(err);
  }
}

/**
 * Convenience helper: translate an EmailServiceError into an Express response.
 * Call this in catch blocks so every controller handles errors the same way.
 */
export function handleEmailError(
  err: unknown,
  res: import("express").Response,
): undefined {
  if (err instanceof EmailServiceError) {
    res.status(err.httpStatus).json({ message: err.message, code: err.code });
    return;
  }
  console.error("Unexpected email error:", err);
  res.status(500).json({ message: "An unexpected error occurred." });
}
