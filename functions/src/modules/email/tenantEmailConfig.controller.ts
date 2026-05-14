import { Response } from "express";
import pool from "../../db";
import { encrypt, decrypt } from "../../utils/encryption";
import env from "../../config/env";
import { AuthRequest } from "../../middleware/auth";
import { verifySmtpCredentials, handleEmailError } from "./emailConfig.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_PROVIDERS = ["zoho", "google_workspace"] as const;
type EmailProvider = (typeof ALLOWED_PROVIDERS)[number];

/**
 * POST /v1/email/tenant-config
 * Save (or update) the tenant-level shared SMTP credentials.
 * Restricted to super_admin and accounts_manager.
 */
export const saveTenantEmailConfig = async (req: AuthRequest, res: Response) => {
  const { email, appPassword, provider: rawProvider, displayName } = req.body as {
    email?: string;
    appPassword?: string;
    provider?: string;
    displayName?: string;
  };

  if (!email || !appPassword) {
    return res.status(400).json({ message: "Both 'email' and 'appPassword' are required." });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Invalid email address format." });
  }

  const provider: EmailProvider =
    rawProvider && ALLOWED_PROVIDERS.includes(rawProvider as EmailProvider)
      ? (rawProvider as EmailProvider)
      : "zoho";

  const stripped = appPassword.replace(/\s/g, "");
  if (stripped.length < 8) {
    return res.status(400).json({
      message: "App password appears too short. Please generate a valid app password.",
    });
  }

  if (!env.EMAIL_ENCRYPTION_KEY) {
    console.error("saveTenantEmailConfig: EMAIL_ENCRYPTION_KEY is not configured");
    return res.status(500).json({ message: "Email feature is not available. Contact support." });
  }

  let resolvedProvider: string;
  try {
    resolvedProvider = await verifySmtpCredentials(email.trim().toLowerCase(), stripped, provider);
  } catch (err) {
    return handleEmailError(err, res);
  }

  let encryptedPassword: string;
  try {
    encryptedPassword = encrypt(stripped);
  } catch (err) {
    console.error("saveTenantEmailConfig: encryption failed", err);
    return res.status(500).json({ message: "Failed to secure your credentials." });
  }

  const tenantId = req.user!.tenant_id;
  const trimmedDisplayName = displayName?.trim() || null;

  try {
    await pool.query(
      `INSERT INTO tenant_email_config
         (tenant_id, email, encrypted_password, provider, display_name, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (tenant_id) DO UPDATE
         SET email              = EXCLUDED.email,
             encrypted_password = EXCLUDED.encrypted_password,
             provider           = EXCLUDED.provider,
             display_name       = EXCLUDED.display_name,
             is_active          = true,
             updated_at         = now()`,
      [tenantId, email.trim().toLowerCase(), encryptedPassword, resolvedProvider, trimmedDisplayName],
    );
    res.json({ message: "Company email connected successfully." });
  } catch (err) {
    console.error("saveTenantEmailConfig: DB error", err);
    res.status(500).json({ message: "Failed to save company email configuration." });
  }
};

/**
 * GET /v1/email/tenant-config
 * Returns safe (password-free) info about the tenant's current SMTP config.
 */
export const getTenantEmailConfig = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `SELECT email, provider, display_name, is_active, updated_at
         FROM tenant_email_config
        WHERE tenant_id = $1
        LIMIT 1`,
      [tenantId],
    );
    if (result.rows.length === 0) return res.json({ configured: false });
    const { email, provider, display_name, is_active, updated_at } = result.rows[0];
    res.json({ configured: true, email, provider, display_name, is_active, updated_at });
  } catch (err) {
    console.error("getTenantEmailConfig: DB error", err);
    res.status(500).json({ message: "Failed to retrieve company email configuration." });
  }
};

/**
 * DELETE /v1/email/tenant-config
 * Remove the tenant's shared SMTP credentials.
 */
export const deleteTenantEmailConfig = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    await pool.query(`DELETE FROM tenant_email_config WHERE tenant_id = $1`, [tenantId]);
    res.json({ message: "Company email configuration removed." });
  } catch (err) {
    console.error("deleteTenantEmailConfig: DB error", err);
    res.status(500).json({ message: "Failed to remove company email configuration." });
  }
};

/**
 * POST /v1/email/tenant-config/test
 * Open an authenticated SMTP connection with the stored tenant credentials.
 * No email is sent — just verifies the credentials still work.
 */
export const testTenantEmailConfig = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query<{
      email: string;
      encrypted_password: string;
      provider: string;
    }>(
      `SELECT email, encrypted_password, provider
         FROM tenant_email_config
        WHERE tenant_id = $1 AND is_active = true
        LIMIT 1`,
      [tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "No company email configured.",
        code: "EMAIL_NOT_CONFIGURED",
      });
    }
    const row = result.rows[0];
    let password: string;
    try {
      password = decrypt(row.encrypted_password);
    } catch {
      return res.status(400).json({
        message: "Company email credentials could not be decrypted. Please reconfigure.",
        code: "EMAIL_DECRYPT_FAILED",
      });
    }
    try {
      await verifySmtpCredentials(row.email, password, row.provider);
      res.json({ ok: true, message: "Company SMTP connection successful." });
    } catch (err) {
      handleEmailError(err, res);
    }
  } catch (err) {
    console.error("testTenantEmailConfig: DB error", err);
    res.status(500).json({ message: "Failed to test company email configuration." });
  }
};
