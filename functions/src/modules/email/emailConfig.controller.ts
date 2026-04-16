import { Response } from "express";
import pool from "../../db";
import { encrypt } from "../../utils/encryption";
import env from "../../config/env";
import { AuthRequest } from "../../middleware/auth";
import { verifySmtpConnection, verifySmtpCredentials, handleEmailError } from "./emailConfig.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Free/personal email providers that are not allowed — only company domain emails accepted
const BLOCKED_PROVIDERS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
];

/**
 * POST /v1/email/config
 * Save (or update) the calling user's SMTP credentials.
 * The app-password is encrypted before being written to the database.
 * The raw password is NEVER logged.
 */
const ALLOWED_PROVIDERS = ["zoho", "google_workspace"] as const;
type EmailProvider = (typeof ALLOWED_PROVIDERS)[number];

export const saveEmailConfig = async (req: AuthRequest, res: Response) => {
  const { email, appPassword, provider: rawProvider } = req.body as {
    email?: string;
    appPassword?: string;
    provider?: string;
  };

  if (!email || !appPassword) {
    return res
      .status(400)
      .json({ message: "Both 'email' and 'appPassword' are required." });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Invalid email address format." });
  }

  // Only allow company domain emails — block common personal providers
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (BLOCKED_PROVIDERS.includes(domain)) {
    return res.status(400).json({
      message:
        "Only company domain emails are allowed. Personal email providers (Gmail, Yahoo, Outlook, etc.) are not supported.",
    });
  }

  // Validate provider — default to 'zoho' for backward compatibility
  const provider: EmailProvider =
    rawProvider && ALLOWED_PROVIDERS.includes(rawProvider as EmailProvider)
      ? (rawProvider as EmailProvider)
      : "zoho";

  // Strip spaces before validation and storage — Zoho displays app passwords
  // with spaces (e.g. "abcd efgh ijkl mnop") but the actual SMTP password is
  // space-free. Storing the raw copy-pasted value breaks SMTP authentication.
  const stripped = appPassword.replace(/\s/g, "");
  if (stripped.length < 8) {
    return res.status(400).json({
      message: "App password appears too short. Please generate a valid app password.",
    });
  }

  if (!env.EMAIL_ENCRYPTION_KEY) {
    console.error("saveEmailConfig: EMAIL_ENCRYPTION_KEY is not configured");
    return res
      .status(500)
      .json({ message: "Email feature is not available. Contact support." });
  }

  // ── Verify SMTP credentials BEFORE storing anything ─────────────────────
  // This catches wrong passwords immediately so we never persist bad creds.
  let resolvedProvider: string;
  try {
    resolvedProvider = await verifySmtpCredentials(
      email.trim().toLowerCase(),
      stripped,
      provider,
    );
  } catch (err) {
    // handleEmailError writes the typed JSON response and returns
    return handleEmailError(err, res);
  }

  let encryptedPassword: string;
  try {
    encryptedPassword = encrypt(stripped); // always store the space-free version
  } catch (err) {
    console.error("saveEmailConfig: encryption failed", err);
    return res.status(500).json({ message: "Failed to secure your credentials." });
  }

  const userId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  try {
    await pool.query(
      `INSERT INTO user_email_config
         (user_id, tenant_id, email, encrypted_password, provider, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (user_id, tenant_id) DO UPDATE
         SET email              = EXCLUDED.email,
             encrypted_password = EXCLUDED.encrypted_password,
             provider           = EXCLUDED.provider,
             is_active          = true,
             updated_at         = now()`,
      [userId, tenantId, email.trim().toLowerCase(), encryptedPassword, resolvedProvider],
    );

    res.json({ message: "Email connected successfully." });
  } catch (err) {
    console.error("saveEmailConfig: DB error", err);
    res.status(500).json({ message: "Failed to save email configuration." });
  }
};

/**
 * GET /v1/email/config
 * Return safe (password-free) info about the user's current email config.
 */
export const getEmailConfig = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  try {
    const result = await pool.query(
      `SELECT email, provider, is_active, updated_at
         FROM user_email_config
        WHERE user_id = $1 AND tenant_id = $2
        LIMIT 1`,
      [userId, tenantId],
    );

    if (result.rows.length === 0) {
      return res.json({ configured: false });
    }

    const { email, provider, is_active, updated_at } = result.rows[0];
    // Deliberately exclude encrypted_password from the response
    res.json({ configured: true, email, provider, is_active, updated_at });
  } catch (err) {
    console.error("getEmailConfig: DB error", err);
    res.status(500).json({ message: "Failed to retrieve email configuration." });
  }
};

/**
 * DELETE /v1/email/config
 * Remove the user's stored SMTP credentials.
 */
export const deleteEmailConfig = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  try {
    await pool.query(
      `DELETE FROM user_email_config WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    res.json({ message: "Email configuration removed." });
  } catch (err) {
    console.error("deleteEmailConfig: DB error", err);
    res.status(500).json({ message: "Failed to remove email configuration." });
  }
};

/**
 * POST /v1/email/config/test
 * Open an authenticated SMTP connection with the stored credentials and
 * immediately close it — no email is sent.  Returns 200 on success or a
 * typed error so the UI can show exactly what is wrong.
 */
export const testEmailConfig = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  try {
    await verifySmtpConnection(userId, tenantId);
    res.json({ ok: true, message: "SMTP connection successful. Your email is ready to send." });
  } catch (err) {
    handleEmailError(err, res);
  }
};
