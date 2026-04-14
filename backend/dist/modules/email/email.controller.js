"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = exports.listTemplates = exports.sendSingleEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const db_1 = __importDefault(require("../../db"));
const env_1 = __importDefault(require("../../config/env"));
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
const transporter = (env_1.default.EMAIL_USER && env_1.default.EMAIL_PASS)
    ? nodemailer_1.default.createTransport({
        service: "gmail",
        auth: { user: env_1.default.EMAIL_USER, pass: env_1.default.EMAIL_PASS }
    })
    : env_1.default.SMTP_HOST
        ? nodemailer_1.default.createTransport({
            host: env_1.default.SMTP_HOST,
            port: Number(env_1.default.SMTP_PORT) || 587,
            secure: env_1.default.SMTP_SECURE === "true",
            auth: env_1.default.SMTP_USER && env_1.default.SMTP_PASS ? { user: env_1.default.SMTP_USER, pass: env_1.default.SMTP_PASS } : undefined,
        })
        : nodemailer_1.default.createTransport({ jsonTransport: true });
const renderTemplate = (template, data) => {
    return template.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_, key) => data[key] || "");
};
const sendSingleEmail = async (req, res) => {
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
        return res.status(400).json({ message: "To, subject, and body are required" });
    }
    try {
        await transporter.sendMail({
            from: env_1.default.EMAIL_USER || env_1.default.EMAIL_FROM || "no-reply@zorhire.com",
            to,
            subject,
            text: body,
            html: `<div style="font-family: sans-serif; white-space: pre-wrap;">${body}</div>`,
        });
        res.json({ message: "Email sent successfully" });
    }
    catch (error) {
        console.error("Send single email error:", error);
        res.status(500).json({ message: "Unable to send email" });
    }
};
exports.sendSingleEmail = sendSingleEmail;
const listTemplates = async (_req, res) => {
    res.json(Object.entries(templateMap).map(([key, template]) => ({
        key,
        ...template,
    })));
};
exports.listTemplates = listTemplates;
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
    const tenantId = req.user?.tenant_id;
    const createdBy = req.user?.id;
    try {
        const sendResults = await Promise.allSettled(recipients.map((recipient) => transporter.sendMail({
            from: env_1.default.EMAIL_FROM,
            to: recipient.email,
            subject,
            text: body,
            html: `<pre style="font-family:inherit;white-space:pre-wrap">${body}</pre>`,
        })));
        const deliveredCount = sendResults.filter((result) => result.status === "fulfilled").length;
        await db_1.default.query(`INSERT INTO email_campaigns (tenant_id, name, subject, body, status, recipient_count, delivered_count, created_by)
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
        res.status(500).json({ message: "Unable to send email" });
    }
};
exports.sendEmail = sendEmail;
