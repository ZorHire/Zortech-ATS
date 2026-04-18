"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = exports.sendSingleEmail = exports.listTemplates = exports.testEmailConfig = exports.removeEmailConfig = exports.saveEmailConfig = exports.getEmailConfig = void 0;
const crypto_1 = __importDefault(require("crypto"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const db_1 = __importDefault(require("../../db"));
const env_1 = __importDefault(require("../../config/env"));
// ─── Encryption helpers ──────────────────────────────────────────────────────
// Passwords are stored as AES-256-GCM ciphertext: "<iv_hex>:<tag_hex>:<ct_hex>"
// SERVER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes) in your .env.
function getEncryptionKey() {
    const hex = env_1.default.ENCRYPTION_KEY;
    if (!hex || hex.length < 64) {
        throw new Error("EMAIL_ENCRYPTION_KEY is not set or too short. " +
            "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    }
    return Buffer.from(hex.slice(0, 64), "hex");
}
function encrypt(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}
function decrypt(stored) {
    const key = getEncryptionKey();
    const parts = stored.split(":");
    if (parts.length !== 3)
        throw new Error("Malformed encrypted value");
    const [ivHex, tagHex, ctHex] = parts;
    const decipher = crypto_1.default.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return (decipher.update(Buffer.from(ctHex, "hex")).toString("utf8") +
        decipher.final("utf8"));
}
// ─── SMTP transporter factory ─────────────────────────────────────────────────
const PROVIDER_SMTP = {
    zoho: { host: "smtppro.zoho.in", port: 465, secure: true },
    google_workspace: { host: "smtp.gmail.com", port: 587, secure: false },
};
function buildTransporter(email, password, provider) {
    const smtp = PROVIDER_SMTP[provider] ?? PROVIDER_SMTP.zoho;
    return nodemailer_1.default.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { type: "LOGIN", user: email, pass: password },
        tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    });
}
// ─── Shared helper: fetch + build transporter for a user ─────────────────────
async function getUserTransporter(userId) {
    const result = await db_1.default.query(`SELECT email, encrypted_password, provider
     FROM user_email_config
     WHERE user_id = $1 AND is_active = true`, [userId]);
    if (result.rows.length === 0)
        return null;
    const { email, encrypted_password, provider } = result.rows[0];
    let password;
    try {
        password = decrypt(encrypted_password);
    }
    catch {
        throw new Error("Stored credentials are corrupt. Please reconnect your email in Settings → Email.");
    }
    return { transporter: buildTransporter(email, password, provider), fromEmail: email };
}
// ─── GET /email/config ────────────────────────────────────────────────────────
const getEmailConfig = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db_1.default.query(`SELECT email, provider, updated_at
       FROM user_email_config
       WHERE user_id = $1`, [userId]);
        if (result.rows.length === 0) {
            return res.json({ configured: false });
        }
        const { email, provider, updated_at } = result.rows[0];
        return res.json({ configured: true, email, provider, updated_at });
    }
    catch (error) {
        console.error("Get email config error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getEmailConfig = getEmailConfig;
// ─── POST /email/config ───────────────────────────────────────────────────────
const saveEmailConfig = async (req, res) => {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const { email, appPassword, provider = "zoho" } = req.body;
    if (!email?.trim() || !appPassword?.trim()) {
        return res
            .status(400)
            .json({ message: "Email and app password are required." });
    }
    if (!["zoho", "google_workspace"].includes(provider)) {
        return res.status(400).json({ message: "Unsupported provider." });
    }
    const cleanPassword = appPassword.replace(/\s+/g, "");
    let encryptedPassword;
    try {
        encryptedPassword = encrypt(cleanPassword);
    }
    catch (err) {
        console.error("Encryption key error:", err.message);
        return res
            .status(500)
            .json({ message: "Encryption not configured on server. Contact admin." });
    }
    try {
        await db_1.default.query(`INSERT INTO user_email_config
         (user_id, tenant_id, email, encrypted_password, provider)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET
         email              = EXCLUDED.email,
         encrypted_password = EXCLUDED.encrypted_password,
         provider           = EXCLUDED.provider,
         is_active          = true,
         updated_at         = now()`, [userId, tenantId, email.trim(), encryptedPassword, provider]);
        res.json({
            configured: true,
            email: email.trim(),
            provider,
            updated_at: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Save email config error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.saveEmailConfig = saveEmailConfig;
// ─── DELETE /email/config ─────────────────────────────────────────────────────
const removeEmailConfig = async (req, res) => {
    const userId = req.user.id;
    try {
        await db_1.default.query(`DELETE FROM user_email_config WHERE user_id = $1`, [userId]);
        res.json({ configured: false });
    }
    catch (error) {
        console.error("Remove email config error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.removeEmailConfig = removeEmailConfig;
// ─── POST /email/config/test ──────────────────────────────────────────────────
const testEmailConfig = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db_1.default.query(`SELECT email, encrypted_password, provider
       FROM user_email_config
       WHERE user_id = $1`, [userId]);
        if (result.rows.length === 0) {
            return res
                .status(400)
                .json({ ok: false, message: "No email configured." });
        }
        const { email, encrypted_password, provider } = result.rows[0];
        let password;
        try {
            password = decrypt(encrypted_password);
        }
        catch {
            return res.status(400).json({
                ok: false,
                message: "Stored credentials are corrupt. Please reconnect your email.",
            });
        }
        const transporter = buildTransporter(email, password, provider);
        await transporter.verify();
        res.json({ ok: true, message: `Connected successfully as ${email}` });
    }
    catch (error) {
        console.error("Test email config error:", error);
        res.status(400).json({
            ok: false,
            message: error?.message ?? "Connection failed. Check your credentials.",
        });
    }
};
exports.testEmailConfig = testEmailConfig;
// ─── Email templates ──────────────────────────────────────────────────────────
const templateMap = {
    outreach: {
        name: "Outreach Template",
        subject: "Exciting Opportunity at {{Company}}",
        body: `Dear {{FirstName}},\n\nI hope you are doing well. I came across your profile and wanted to share an opportunity for the {{JobTitle}} role at {{Company}}. If you are open to a new conversation, I would love to connect and share more details.\n\nBest regards,\n{{RecruiterName}}`,
    },
    interview: {
        name: "Interview Invite Template",
        subject: "Interview Invitation for {{JobTitle}}",
        body: `Dear {{FirstName}},\n\nThank you for your interest in the {{JobTitle}} role. We would like to invite you for an interview on {{InterviewDate}}. Please let me know your availability and I will send the meeting details.\n\nRegards,\n{{RecruiterName}}`,
    },
    offer: {
        name: "Offer Communication Template",
        subject: "Offer for {{JobTitle}} at {{Company}}",
        body: `Dear {{FirstName}},\n\nWe are excited to share that we would like to extend an offer for the {{JobTitle}} role at {{Company}}. I will send the formal details shortly.\n\nWarm regards,\n{{RecruiterName}}`,
    },
};
const listTemplates = async (_req, res) => {
    res.json(Object.entries(templateMap).map(([key, template]) => ({ key, ...template })));
};
exports.listTemplates = listTemplates;
// ─── POST /email/send-single ──────────────────────────────────────────────────
const sendSingleEmail = async (req, res) => {
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
        return res
            .status(400)
            .json({ message: "To, subject, and body are required" });
    }
    try {
        const userMail = await getUserTransporter(req.user.id);
        if (!userMail) {
            return res.status(400).json({
                message: "Email not configured. Go to Settings → Email to connect your email.",
            });
        }
        await userMail.transporter.sendMail({
            from: userMail.fromEmail,
            to,
            subject,
            text: body,
            html: `<div style="font-family:sans-serif;white-space:pre-wrap">${body}</div>`,
        });
        res.json({ message: "Email sent successfully" });
    }
    catch (error) {
        console.error("Send single email error:", error);
        res
            .status(500)
            .json({ message: error?.message ?? "Unable to send email" });
    }
};
exports.sendSingleEmail = sendSingleEmail;
// ─── POST /email/send ─────────────────────────────────────────────────────────
const sendEmail = async (req, res) => {
    const { subject, body, recipients } = req.body;
    if (!subject ||
        !body ||
        !Array.isArray(recipients) ||
        recipients.length === 0) {
        return res
            .status(400)
            .json({ message: "Subject, body, and recipients are required" });
    }
    const tenantId = req.user.tenant_id;
    const createdBy = req.user.id;
    try {
        const userMail = await getUserTransporter(createdBy);
        if (!userMail) {
            return res.status(400).json({
                message: "Email not configured. Go to Settings → Email to connect your email.",
            });
        }
        const sendResults = await Promise.allSettled(recipients.map((recipient) => userMail.transporter.sendMail({
            from: userMail.fromEmail,
            to: recipient.email,
            subject,
            text: body,
            html: `<pre style="font-family:inherit;white-space:pre-wrap">${body}</pre>`,
        })));
        const deliveredCount = sendResults.filter((r) => r.status === "fulfilled").length;
        await db_1.default.query(`INSERT INTO email_campaigns
         (tenant_id, name, subject, body, status, recipient_count, delivered_count, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            tenantId,
            `Manual send ${new Date().toISOString()}`,
            subject,
            body,
            "sent",
            recipients.length,
            deliveredCount,
            createdBy,
        ]);
        res.json({
            message: "Emails processed",
            delivered_count: deliveredCount,
            recipients: recipients.length,
        });
    }
    catch (error) {
        console.error("Send email error:", error);
        res.status(500).json({ message: error?.message ?? "Unable to send email" });
    }
};
exports.sendEmail = sendEmail;
