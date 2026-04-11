"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCandidate = exports.updateCandidate = exports.createCandidate = exports.getCandidateById = exports.getCandidates = void 0;
const path_1 = __importDefault(require("path"));
const db_1 = __importDefault(require("../../db"));
const parse_utils_1 = require("../parse/parse.utils");
const normalizeSkills = (value) => {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed))
                return parsed;
        }
        catch {
            return value
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item !== "");
        }
    }
    return [];
};
const getCandidates = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const { search, location, skills, min_experience, max_experience } = req.query;
        const filters = ["tenant_id = $1", "deleted_at IS NULL"];
        const params = [tenantId];
        if (search) {
            params.push(`%${String(search).toLowerCase()}%`);
            filters.push(`(LOWER(first_name) LIKE $${params.length} OR LOWER(last_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR LOWER(current_title) LIKE $${params.length} OR LOWER(current_company) LIKE $${params.length} OR LOWER(current_location) LIKE $${params.length})`);
        }
        if (location) {
            params.push(`%${String(location).toLowerCase()}%`);
            filters.push(`LOWER(current_location) LIKE $${params.length}`);
        }
        if (skills) {
            String(skills)
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
                .forEach((skill) => {
                params.push(skill.toLowerCase());
                filters.push(`EXISTS (SELECT 1 FROM unnest(skills) s WHERE LOWER(s) = $${params.length})`);
            });
        }
        if (min_experience) {
            params.push(Number(min_experience));
            filters.push(`experience_years >= $${params.length}`);
        }
        if (max_experience) {
            params.push(Number(max_experience));
            filters.push(`experience_years <= $${params.length}`);
        }
        const query = `SELECT * FROM candidates WHERE ${filters.join(" AND ")} ORDER BY created_at DESC`;
        const result = await db_1.default.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        console.error("Get candidates error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCandidates = getCandidates;
const getCandidateById = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    try {
        const result = await db_1.default.query("SELECT * FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", [id, tenantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Candidate not found" });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error("Get candidate error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCandidateById = getCandidateById;
const createCandidate = async (req, res) => {
    const file = req.file;
    const body = req.body || {};
    const tenantId = req.user?.tenant_id;
    const createdBy = req.user?.id;
    const resumeText = (file ? await (0, parse_utils_1.extractFileText)(file) : "") + " " + (body.resume_text || "");
    const parsed = (0, parse_utils_1.parseResumeText)(resumeText);
    const first_name = body.first_name || parsed.name?.split(" ")[0] || "Candidate";
    const last_name = body.last_name || parsed.name?.split(" ").slice(1).join(" ") || "Profile";
    const email = body.email || parsed.email;
    const phone = body.phone || parsed.phone;
    const current_title = body.current_title || parsed.current_title || "";
    const current_company = body.current_company || parsed.current_company || "";
    const experience_years = Number(body.experience_years || parsed.experience_years || 0);
    const current_location = body.current_location || parsed.current_location || "";
    const preferred_location = body.preferred_location || "";
    const notice_period_days = Number(body.notice_period_days || 30);
    const current_ctc = body.current_ctc ? Number(body.current_ctc) : null;
    const expected_ctc = body.expected_ctc ? Number(body.expected_ctc) : null;
    const skills = normalizeSkills(body.skills || parsed.skills);
    const summary = body.summary || parsed.summary || "";
    const source = body.source || "direct";
    const gdpr_consent = body.gdpr_consent === "true" || body.gdpr_consent === true;
    const resumeUrl = file
        ? `/uploads/resumes/${path_1.default.basename(file.path)}`
        : body.resume_url || null;
    try {
        if (!email && !phone) {
            return res.status(400).json({
                message: "At least email or phone is required for candidate creation",
            });
        }
        const duplicateResult = await db_1.default.query(`SELECT id FROM candidates WHERE tenant_id = $1 AND deleted_at IS NULL AND (LOWER(email) = LOWER($2) OR (phone IS NOT NULL AND phone = $3)) LIMIT 1`, [tenantId, email, phone]);
        if (duplicateResult.rows.length > 0) {
            return res
                .status(409)
                .json({ message: "Candidate with this email or phone already exists" });
        }
        const result = await db_1.default.query(`INSERT INTO candidates (tenant_id, first_name, last_name, email, phone, current_title, current_company, experience_years, current_location, preferred_location, notice_period_days, current_ctc, expected_ctc, skills, summary, resume_url, source, gdpr_consent, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`, [
            tenantId,
            first_name,
            last_name,
            email,
            phone,
            current_title,
            current_company,
            experience_years,
            current_location,
            preferred_location,
            notice_period_days,
            current_ctc,
            expected_ctc,
            skills,
            summary,
            resumeUrl,
            source,
            gdpr_consent,
            createdBy,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error("Create candidate error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createCandidate = createCandidate;
const updateCandidate = async (req, res) => {
    const { id } = req.params;
    const file = req.file;
    const body = req.body || {};
    const tenantId = req.user?.tenant_id;
    const resumeUrl = file
        ? `/uploads/resumes/${path_1.default.basename(file.path)}`
        : body.resume_url;
    const skills = normalizeSkills(body.skills);
    try {
        const result = await db_1.default.query(`UPDATE candidates SET 
       first_name = COALESCE($1, first_name),
       last_name = COALESCE($2, last_name),
       email = COALESCE($3, email),
       phone = COALESCE($4, phone),
       current_title = COALESCE($5, current_title),
       current_company = COALESCE($6, current_company),
       experience_years = COALESCE($7, experience_years),
       current_location = COALESCE($8, current_location),
       preferred_location = COALESCE($9, preferred_location),
       notice_period_days = COALESCE($10, notice_period_days),
       current_ctc = COALESCE($11, current_ctc),
       expected_ctc = COALESCE($12, expected_ctc),
       skills = COALESCE($13, skills),
       summary = COALESCE($14, summary),
       resume_url = COALESCE($15, resume_url),
       source = COALESCE($16, source),
       is_active = COALESCE($17, is_active),
       updated_at = now()
       WHERE id = $18 AND tenant_id = $19 AND deleted_at IS NULL
       RETURNING *`, [
            body.first_name,
            body.last_name,
            body.email,
            body.phone,
            body.current_title,
            body.current_company,
            body.experience_years ? Number(body.experience_years) : undefined,
            body.current_location,
            body.preferred_location,
            body.notice_period_days ? Number(body.notice_period_days) : undefined,
            body.current_ctc ? Number(body.current_ctc) : undefined,
            body.expected_ctc ? Number(body.expected_ctc) : undefined,
            skills.length > 0 ? skills : undefined,
            body.summary,
            resumeUrl,
            body.source,
            body.is_active,
            id,
            tenantId,
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Candidate not found" });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error("Update candidate error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateCandidate = updateCandidate;
const deleteCandidate = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    try {
        const result = await db_1.default.query("UPDATE candidates SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id", [id, tenantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Candidate not found" });
        }
        res.json({ message: "Candidate deleted successfully" });
    }
    catch (error) {
        console.error("Delete candidate error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteCandidate = deleteCandidate;
