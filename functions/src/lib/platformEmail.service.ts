/**
 * Platform-level email sender.
 *
 * Sends emails FROM ZorHire TO new tenants/admins using the ZorTech platform
 * tenant's configured SMTP (tenant_email_config WHERE tenant_id = PLATFORM_TENANT_ID).
 *
 * If no platform SMTP is configured, logs a warning and skips — never throws.
 * All lifecycle emails (welcome, nudge, pro-tips) route through this module.
 */

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import pool from "../db";
import { decrypt } from "../utils/encryption";
import { PLATFORM_TENANT_ID } from "../modules/tenants/tenantBootstrap.service";

// ─── Transport builder (mirrors emailConfig.service.ts) ──────────────────────

function buildTransporterOptions(
  provider: string,
  email: string,
  password: string,
): SMTPTransport.Options {
  const timeouts = {
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 15_000,
  };

  if (provider === "zoho") {
    return { host: "smtp.zoho.com", port: 465, secure: true, auth: { user: email, pass: password }, ...timeouts };
  }
  if (provider === "zoho_in") {
    return { host: "smtp.zoho.in", port: 465, secure: true, auth: { user: email, pass: password }, ...timeouts };
  }
  if (provider === "zoho_in_pro") {
    return { host: "smtppro.zoho.in", port: 465, secure: true, auth: { user: email, pass: password }, ...timeouts };
  }
  if (provider === "gmail" || provider === "google_workspace") {
    return { host: "smtp.gmail.com", port: 587, secure: false, auth: { user: email, pass: password }, ...timeouts };
  }
  return { host: provider, port: 587, secure: false, auth: { user: email, pass: password }, ...timeouts };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PlatformEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email from the ZorHire platform account.
 * Returns true on success, false if platform SMTP is not configured or send fails.
 * Never throws — callers should not fail because of a missed email.
 */
export async function sendPlatformEmail(params: PlatformEmailParams): Promise<boolean> {
  try {
    const result = await pool.query<{
      email: string;
      encrypted_password: string;
      provider: string;
      display_name: string | null;
    }>(
      `SELECT email, encrypted_password, provider, display_name
         FROM tenant_email_config
        WHERE tenant_id = $1 AND is_active = true
        LIMIT 1`,
      [PLATFORM_TENANT_ID],
    );

    if (result.rows.length === 0) {
      console.warn("[platformEmail] No platform SMTP configured — skipping email to", params.to);
      return false;
    }

    const row = result.rows[0];
    let password: string;
    try {
      password = decrypt(row.encrypted_password);
    } catch (e) {
      console.error("[platformEmail] Failed to decrypt platform SMTP credentials:", (e as Error).message);
      return false;
    }

    const transport = nodemailer.createTransport(
      buildTransporterOptions(row.provider, row.email, password),
    );

    const displayName = row.display_name || "ZorHire Team";
    await transport.sendMail({
      from: `"${displayName}" <${row.email}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    console.log(`[platformEmail] Sent "${params.subject}" to ${params.to}`);
    return true;
  } catch (err: any) {
    console.error("[platformEmail] Failed to send email to", params.to, ":", err.message);
    return false;
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

export function buildWelcomeEmail(opts: {
  firstName: string;
  companyName: string;
  planName: string;
  frontendUrl: string;
}): string {
  const { firstName, companyName, planName, frontendUrl } = opts;
  const onboardingUrl = `${frontendUrl}/onboarding`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ZorHire</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0D1B2A;padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="margin:0;color:#00E5FF;font-size:28px;font-weight:800;letter-spacing:-0.5px;">ZorHire</h1>
              <p style="margin:8px 0 0;color:#8899aa;font-size:13px;">Applicant Tracking System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px;">
              <h2 style="margin:0 0 8px;color:#0D1B2A;font-size:22px;font-weight:700;">
                Welcome aboard, ${firstName}! 🎉
              </h2>
              <p style="margin:0 0 20px;color:#4a5568;font-size:15px;line-height:1.6;">
                <strong>${companyName}</strong>'s <strong>${planName}</strong> subscription is now active.
                You're all set to start building your dream hiring team.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="background:#00E5FF;border-radius:8px;padding:14px 28px;">
                    <a href="${onboardingUrl}" style="color:#0D1B2A;font-weight:700;font-size:15px;text-decoration:none;display:block;">
                      Complete Your Setup →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <p style="margin:28px 0 12px;color:#0D1B2A;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                Your 6 onboarding steps (~35 mins total)
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ["1", "Set up company profile", "5 mins"],
                  ["2", "Invite your hiring team", "3 mins"],
                  ["3", "Build your hiring pipeline", "10 mins"],
                  ["4", "Connect your channels", "8 mins"],
                  ["5", "Post your first job", "7 mins"],
                  ["6", "Go live", "2 mins"],
                ].map(([num, title, time]) => `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="28" style="vertical-align:top;">
                          <span style="display:inline-block;width:22px;height:22px;background:#0D1B2A;color:#00E5FF;border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:700;">${num}</span>
                        </td>
                        <td style="color:#2d3748;font-size:14px;vertical-align:middle;">${title}</td>
                        <td align="right" style="color:#718096;font-size:12px;white-space:nowrap;">${time}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>

              <!-- Resources -->
              <p style="margin:28px 0 12px;color:#0D1B2A;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                Resources to get you started
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:4px 12px 4px 0;">
                    <a href="${frontendUrl}/onboarding" style="color:#00E5FF;font-size:14px;text-decoration:none;">📘 Getting Started Guide</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 12px 4px 0;">
                    <a href="mailto:hello@zorhire.com" style="color:#00E5FF;font-size:14px;text-decoration:none;">💬 Book Onboarding Call</a>
                  </td>
                </tr>
              </table>

              <!-- Support -->
              <div style="margin-top:32px;padding:16px;background:#f7fafc;border-radius:8px;border-left:3px solid #00E5FF;">
                <p style="margin:0;color:#4a5568;font-size:13px;">
                  Need help? Email us at <a href="mailto:hello@zorhire.com" style="color:#00E5FF;">hello@zorhire.com</a>
                  or chat with us Mon–Fri, 9am–6pm IST.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#a0aec0;font-size:12px;">
                ZorHire · hello@zorhire.com · docs.zorhire.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildNudgeEmail(opts: {
  firstName: string;
  companyName: string;
  frontendUrl: string;
  incompleteSteps: string[];
}): string {
  const { firstName, frontendUrl, incompleteSteps } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Your ZorHire setup is waiting</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr>
          <td style="background:#0D1B2A;padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="margin:0;color:#00E5FF;font-size:28px;font-weight:800;">ZorHire</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px;">
            <h2 style="margin:0 0 12px;color:#0D1B2A;">⚡ Hey ${firstName}, your setup is waiting!</h2>
            <p style="color:#4a5568;font-size:15px;line-height:1.6;">
              You're just ~35 minutes away from a fully live hiring system. Here's what's left:
            </p>
            <ul style="color:#2d3748;font-size:14px;line-height:2;">
              ${incompleteSteps.map((s) => `<li>${s}</li>`).join("")}
            </ul>
            <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td style="background:#00E5FF;border-radius:8px;padding:14px 28px;">
                  <a href="${frontendUrl}/onboarding" style="color:#0D1B2A;font-weight:700;font-size:15px;text-decoration:none;">Resume your setup →</a>
                </td>
              </tr>
            </table>
            <p style="color:#718096;font-size:13px;">
              Want a guided walkthrough? <a href="mailto:hello@zorhire.com" style="color:#00E5FF;">Book a free onboarding call</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
