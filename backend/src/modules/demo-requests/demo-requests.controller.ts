import { Request, Response } from "express";
import pool from "../../db";
import env from "../../config/env";
import { getTenantTransporter } from "../email/email.controller";

/**
 * POST /v1/demo-requests (public, rate-limited)
 *
 * Prospects can't self-register: new client companies are onboarded by the
 * ZorTech team after a demo. This endpoint emails the request to the sales
 * inbox using the platform owner's (ZorTech's) configured company mailbox.
 * Nothing is stored; if mail can't be sent we return 503 and the page falls
 * back to a pre-filled mailto: link so the lead is never silently lost.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEAM_SIZES = new Set(["1-10", "11-50", "51-200", "201-1000", "1000+"]);

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const createDemoRequest = async (req: Request, res: Response) => {
  const body = req.body ?? {};

  // Honeypot: real users never see or fill the "website" field.
  if (clean(body.website, 200)) {
    return res.status(202).json({ message: "Thanks! We'll be in touch shortly." });
  }

  const name = clean(body.name, 100);
  const email = clean(body.email, 200).toLowerCase();
  const company = clean(body.company, 150);
  const phone = clean(body.phone, 30);
  const role = clean(body.role, 100);
  const teamSize = TEAM_SIZES.has(clean(body.teamSize, 20)) ? clean(body.teamSize, 20) : "";
  const message = clean(body.message, 2000);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Please enter your name.";
  if (!EMAIL_RE.test(email)) errors.email = "Please enter a valid work email.";
  if (company.length < 2) errors.company = "Please enter your company name.";
  if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) errors.phone = "Please enter a valid phone number.";
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: "Please check the highlighted fields.", errors });
  }

  try {
    const owner = await pool.query(
      "SELECT id FROM tenants WHERE is_platform_owner = true LIMIT 1",
    );
    const mailer = owner.rows[0] ? await getTenantTransporter(owner.rows[0].id) : null;
    if (!mailer) {
      console.error("createDemoRequest: platform owner has no active company mailbox configured");
      return res.status(503).json({ message: "We couldn't send your request right now." });
    }

    const rows: Array<[string, string]> = [
      ["Name", name],
      ["Work email", email],
      ["Company", company],
      ["Role", role],
      ["Phone", phone],
      ["Team size", teamSize],
      ["Message", message],
    ];
    const html =
      `<p>New ZorHire demo request:</p><table cellpadding="6" style="border-collapse:collapse">` +
      rows
        .filter(([, v]) => v)
        .map(
          ([k, v]) =>
            `<tr><td style="color:#5F6B76;vertical-align:top">${k}</td><td>${escapeHtml(v).replace(/\n/g, "<br>")}</td></tr>`,
        )
        .join("") +
      `</table>`;
    const text = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");

    await mailer.transporter.sendMail({
      from: mailer.fromEmail,
      to: env.DEMO_REQUEST_TO,
      replyTo: email,
      subject: `ZorHire demo request: ${company.replace(/[\r\n]+/g, " ")}`,
      html,
      text,
    });

    return res.status(201).json({ message: "Thanks! We'll be in touch within one business day." });
  } catch (err) {
    console.error("createDemoRequest error:", (err as Error).message);
    return res.status(503).json({ message: "We couldn't send your request right now." });
  }
};
