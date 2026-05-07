"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = exports.assignJdRecruiter = exports.assignJd = exports.sendSingleEmail = exports.listTemplates = exports.testEmailConfig = exports.removeEmailConfig = exports.saveEmailConfig = exports.getEmailConfig = void 0;
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
    zoho: { host: "smtp.zoho.com", port: 465, secure: true },
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
// ─── SMTP error classifier ────────────────────────────────────────────────────
function classifySmtpError(error) {
    const msg = String(error?.message ?? "").toLowerCase();
    const rc = error?.responseCode;
    if (error?.code === "EAUTH" ||
        rc === 535 ||
        msg.includes("invalid credentials") ||
        msg.includes("authentication failed") ||
        msg.includes("username and password not accepted")) {
        return {
            code: "SMTP_AUTH_FAILED",
            message: "Authentication failed. Please check your email and app password in Settings → Email.",
        };
    }
    if (msg.includes("smtp access is not enabled") ||
        msg.includes("smtp not enabled") ||
        msg.includes("please enable smtp")) {
        return {
            code: "SMTP_NOT_ENABLED",
            message: "SMTP access is disabled on your account. Enable it in your email provider's security settings.",
        };
    }
    if (rc === 421 ||
        msg.includes("rate limit") ||
        msg.includes("too many") ||
        msg.includes("daily sending quota")) {
        return {
            code: "SMTP_LIMIT_REACHED",
            message: "Email sending limit reached. Please try again later.",
        };
    }
    return {
        code: "SMTP_ERROR",
        message: error?.message ?? "Unable to send email",
    };
}
// ─── Shared helper: fetch + build transporter for a user ─────────────────────
async function getUserTransporter(userId) {
    let result;
    try {
        result = await db_1.default.query(`SELECT email, encrypted_password, provider
       FROM user_email_config
       WHERE user_id = $1 AND is_active = true`, [userId]);
    }
    catch (err) {
        // Fallback if is_active column is missing
        if (err?.code === "42703") {
            result = await db_1.default.query(`SELECT email, encrypted_password, provider
         FROM user_email_config
         WHERE user_id = $1`, [userId]);
        }
        else {
            throw err;
        }
    }
    if (result.rows.length === 0)
        return null;
    const { email, encrypted_password, provider } = result.rows[0];
    let password;
    try {
        password = decrypt(encrypted_password);
    }
    catch (err) {
        console.error("getUserTransporter decrypt error:", err.message);
        throw new Error("Stored credentials are corrupt or encryption key is missing. Please reconnect your email in Settings → Email.");
    }
    return {
        transporter: buildTransporter(email, password, provider),
        fromEmail: email,
    };
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
        await db_1.default.query(`DELETE FROM user_email_config WHERE user_id = $1`, [
            userId,
        ]);
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
    res.json(Object.entries(templateMap).map(([key, template]) => ({
        key,
        ...template,
    })));
};
exports.listTemplates = listTemplates;
// ─── POST /email/send-single ──────────────────────────────────────────────────
const sendSingleEmail = async (req, res) => {
    const { to, subject, body, firstName } = req.body;
    if (!to || !subject) {
        return res.status(400).json({ message: "To and subject are required" });
    }
    try {
        const userMail = await getUserTransporter(req.user.id);
        if (!userMail) {
            return res.status(400).json({
                code: "EMAIL_NOT_CONFIGURED",
                message: "Email not configured. Go to Settings → Email to connect your email.",
            });
        }
        const greeting = firstName ? `Dear ${firstName},\n\n` : "";
        const finalBody = body ?? `${greeting}${subject}`;
        await userMail.transporter.sendMail({
            from: userMail.fromEmail,
            to,
            subject,
            text: finalBody,
            html: `<div style="font-family:sans-serif;white-space:pre-wrap">${finalBody}</div>`,
        });
        res.json({ message: "Email sent successfully" });
    }
    catch (error) {
        console.error("Send single email error:", error);
        const { code, message } = classifySmtpError(error);
        res.status(500).json({ code, message });
    }
};
exports.sendSingleEmail = sendSingleEmail;
// ─── POST /email/assign-jd ───────────────────────────────────────────────────
const assignJd = async (req, res) => {
    const { vendor_id, job_id, deadline_days, site_url } = req.body;
    if (!vendor_id || !job_id || !deadline_days) {
        return res
            .status(400)
            .json({ message: "vendor_id, job_id, and deadline_days are required" });
    }
    const tenantId = req.user.tenant_id;
    try {
        const [jobResult, vendorResult] = await Promise.all([
            db_1.default.query("SELECT id, title FROM jobs WHERE id = $1 AND tenant_id = $2", [job_id, tenantId]),
            db_1.default.query("SELECT id, company_name, primary_contact_email FROM vendors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", [vendor_id, tenantId]),
        ]);
        if (jobResult.rows.length === 0)
            return res.status(404).json({ message: "Job not found" });
        if (vendorResult.rows.length === 0)
            return res.status(404).json({ message: "Vendor not found" });
        const job = jobResult.rows[0];
        const vendor = vendorResult.rows[0];
        const days = Number(deadline_days);
        const dayLabel = days === 1 ? "1 day" : `${days} days`;
        const urlPart = site_url ? ` at ${site_url}` : "";
        const body = `You have been assigned "${job.title}" and you have ${dayLabel} to add candidates to the JD${urlPart}.`;
        const userMail = await getUserTransporter(req.user.id);
        if (!userMail) {
            return res.status(400).json({
                code: "EMAIL_NOT_CONFIGURED",
                message: "Email not configured. Go to Settings → Email to connect your email.",
            });
        }
        try {
            await userMail.transporter.sendMail({
                from: userMail.fromEmail,
                to: vendor.primary_contact_email,
                subject: `JD Assignment: ${job.title}`,
                text: body,
                html: `<div style="font-family:sans-serif;line-height:1.6">${body}</div>`,
            });
            res.json({ message: "Assignment email sent successfully" });
        }
        catch (sendError) {
            console.error("Assign JD send email error:", sendError);
            const { code, message } = classifySmtpError(sendError);
            const status = code === "SMTP_ERROR" ? 500 : 400;
            res.status(status).json({ code, message });
        }
    }
    catch (error) {
        console.error("Assign JD processing error:", error);
        res.status(500).json({ message: "Internal server error during JD assignment" });
    }
};
exports.assignJd = assignJd;
// POST /email/assign-jd-recruiter
const assignJdRecruiter = async (req, res) => {
    const { recruiter_id, job_id, deadline_days, site_url } = req.body;
    console.log("assignJD payload:", {
        recruiter_id,
        job_id,
        deadline_days,
        site_url,
    });
    console.log("assignJD user:", {
        id: req.user?.id,
        tenant_id: req.user?.tenant_id,
        role: req.user?.role,
    });
    console.log("assignJD tenant:", req.user?.tenant_id);
    if (!req.user?.id || !req.user?.tenant_id) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    if (!recruiter_id || !job_id || !deadline_days) {
        return res
            .status(400)
            .json({
            message: "recruiter_id, job_id, and deadline_days are required",
        });
    }
    // Prevent avoidable DB failures (e.g., invalid input syntax for uuid).
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(String(recruiter_id)) ||
        !uuidPattern.test(String(job_id))) {
        return res.status(400).json({ message: "Invalid recruiter_id or job_id" });
    }
    const days = Number(deadline_days);
    if (!Number.isFinite(days) || days <= 0) {
        return res
            .status(400)
            .json({ message: "deadline_days must be a positive number" });
    }
    const tenantId = req.user.tenant_id;
    try {
        console.log("assign-jd-recruiter: fetching job and recruiter", {
            tenantId,
            recruiter_id,
            job_id,
        });
        let jobResult;
        try {
            jobResult = await db_1.default.query("SELECT id, title FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", [job_id, tenantId]);
        }
        catch (jobQueryError) {
            console.error("assignJD jobs query failed:", jobQueryError);
            if (jobQueryError?.code !== "42703") {
                throw jobQueryError;
            }
            jobResult = await db_1.default.query("SELECT id, title FROM jobs WHERE id = $1 AND tenant_id = $2", [job_id, tenantId]);
        }
        let recruiterResult;
        try {
            recruiterResult = await db_1.default.query(`SELECT u.id, u.email, p.full_name
         FROM users u
         INNER JOIN tenant_memberships tm ON tm.user_id = u.id
         LEFT JOIN profiles p ON p.id = u.id
         WHERE u.id = $1
           AND tm.tenant_id = $2
           AND tm.role = 'recruiter'
           AND tm.is_active = true
           AND u.is_active = true`, [recruiter_id, tenantId]);
        }
        catch (recruiterQueryError) {
            console.error("assignJD recruiter query failed:", recruiterQueryError);
            recruiterResult = await db_1.default.query(`SELECT u.id, u.email, p.full_name
         FROM users u
         INNER JOIN tenant_memberships tm ON tm.user_id = u.id
         LEFT JOIN profiles p ON p.id = u.id
         WHERE u.id = $1
           AND tm.tenant_id = $2
           AND tm.role = 'recruiter'`, [recruiter_id, tenantId]);
        }
        if (jobResult.rows.length === 0) {
            return res.status(404).json({ message: "Job not found" });
        }
        if (recruiterResult.rows.length === 0) {
            return res.status(404).json({ message: "Recruiter not found" });
        }
        const job = jobResult.rows[0];
        const recruiter = recruiterResult.rows[0];
        if (!job || !recruiter) {
            return res.status(404).json({ message: "Job or recruiter not found" });
        }
        // Keep assignment state in sync with notification.
        console.log("assign-jd-recruiter: updating assigned_recruiter_id", {
            job_id,
            recruiter_id,
            tenantId,
        });
        try {
            await db_1.default.query(`UPDATE jobs
         SET assigned_recruiter_id = $1, updated_at = now()
         WHERE id = $2 AND tenant_id = $3`, [recruiter_id, job_id, tenantId]);
        }
        catch (assignUpdateError) {
            console.error("assignJD update query failed:", assignUpdateError);
            // Compatibility fallback for older deployed schemas.
            // If assignment columns are missing, continue with email notification instead of 500.
            const sqlState = assignUpdateError?.code;
            if (sqlState !== "42703") {
                throw assignUpdateError;
            }
            console.error("assign-jd-recruiter: assignment column missing, continuing with email-only flow:", assignUpdateError);
        }
        const dayLabel = days === 1 ? "1 day" : `${days} days`;
        const urlPart = site_url ? ` at ${site_url}` : "";
        const recruiterName = recruiter.full_name && String(recruiter.full_name).trim().length > 0
            ? recruiter.full_name
            : recruiter.email;
        const body = `Hi ${recruiterName},\n\n` +
            `You have been assigned "${job.title}". Please submit candidates within ${dayLabel}${urlPart}.`;
        try {
            console.log("assign-jd-recruiter: loading SMTP transporter", {
                sender_user_id: req.user.id,
            });
            const userMail = await getUserTransporter(req.user.id);
            if (!userMail) {
                return res.status(200).json({
                    message: "Recruiter assigned successfully, but assignment email could not be sent.",
                    email_error: {
                        code: "EMAIL_NOT_CONFIGURED",
                        message: "Your email is not configured. Go to Settings → Email to connect your email.",
                    },
                });
            }
            console.log("assign-jd-recruiter: sending recruiter email", {
                to: recruiter.email,
                subject: `JD Assignment: ${job.title}`,
            });
            await userMail.transporter.sendMail({
                from: userMail.fromEmail,
                to: recruiter.email,
                subject: `JD Assignment: ${job.title}`,
                text: body,
                html: `<div style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6">${body}</div>`,
            });
            return res.json({
                message: "Recruiter assignment email sent successfully",
            });
        }
        catch (mailError) {
            console.error("Email failed:", mailError);
            // Do not fail the assignment update if email sending fails or transporter build fails.
            const { code, message } = classifySmtpError(mailError);
            return res.status(200).json({
                message: "Recruiter assigned successfully, but assignment email could not be sent.",
                email_error: { code, message },
            });
        }
    }
    catch (error) {
        console.error("assignJD error:", error);
        return res.status(500).json({
            message: "Internal server error",
            debug: env_1.default.NODE_ENV === "development" ? error?.message : undefined,
        });
    }
};
exports.assignJdRecruiter = assignJdRecruiter;
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
                code: "EMAIL_NOT_CONFIGURED",
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
