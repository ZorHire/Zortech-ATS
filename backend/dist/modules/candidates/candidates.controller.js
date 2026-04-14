"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCandidates = exports.searchCandidates = exports.deleteCandidate = exports.updateCandidate = exports.createCandidate = exports.getCandidateById = exports.getCandidates = void 0;
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
// ─── helpers ────────────────────────────────────────────────────────────────
const EXPERIENCE_RANGES = {
    "0-3 yrs": [0, 3],
    "3-7 yrs": [3, 7],
    "7+ yrs": [7, null],
};
function buildSearchFilters(tenantId, query) {
    const { location, experience, noticePeriod } = query;
    // NOTE: intentionally omits is_active filter — matches getCandidates behaviour
    // and avoids excluding rows where is_active IS NULL (no NOT NULL on schema)
    const filters = ["tenant_id = $1", "deleted_at IS NULL"];
    const params = [tenantId];
    if (location && location !== "All") {
        params.push(`%${String(location).toLowerCase()}%`);
        filters.push(`LOWER(current_location) LIKE $${params.length}`);
    }
    if (experience && experience !== "All") {
        const range = EXPERIENCE_RANGES[String(experience)];
        if (range) {
            params.push(range[0]);
            filters.push(`experience_years >= $${params.length}`);
            if (range[1] !== null) {
                params.push(range[1]);
                filters.push(`experience_years <= $${params.length}`);
            }
        }
    }
    if (noticePeriod && noticePeriod !== "Any") {
        if (noticePeriod === "< 30 days") {
            filters.push("notice_period_days < 30");
        }
        else if (noticePeriod === "30-60 days") {
            filters.push("notice_period_days BETWEEN 30 AND 60");
        }
        else if (noticePeriod === "60+ days") {
            filters.push("notice_period_days > 60");
        }
    }
    return { filters, params };
}
function normalizeSkillsArray(raw) {
    if (Array.isArray(raw)) {
        return raw.map((s) => String(s).toLowerCase());
    }
    // pg may return a PostgreSQL array literal string e.g. '{React,"Node.js"}'
    if (typeof raw === "string" && raw.startsWith("{") && raw.endsWith("}")) {
        return raw
            .slice(1, -1)
            .split(",")
            .map((s) => s.replace(/^"|"$/g, "").trim().toLowerCase())
            .filter(Boolean);
    }
    return [];
}
function scoreCandidate(candidate, queryTerms) {
    if (queryTerms.length === 0)
        return 100;
    const skills = normalizeSkillsArray(candidate.skills);
    const title = (candidate.current_title || "").toLowerCase();
    const summary = (candidate.summary || "").toLowerCase();
    let skillMatches = 0;
    let titleMatch = false;
    let summaryMatch = false;
    for (const term of queryTerms) {
        if (skills.some((s) => s.includes(term) || term.includes(s)))
            skillMatches++;
        if (title.includes(term))
            titleMatch = true;
        if (summary.includes(term))
            summaryMatch = true;
    }
    return Math.min(98, 50 + skillMatches * 12 + (titleMatch ? 25 : 0) + (summaryMatch ? 10 : 0));
}
// ─── search ─────────────────────────────────────────────────────────────────
const searchCandidates = async (req, res) => {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
        return res.status(403).json({ message: "Tenant context missing" });
    }
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    const rawQuery = req.query.query;
    const pageNum = Math.max(1, parseInt(String(rawPage ?? "1"), 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(String(rawLimit ?? "10"), 10) || 10));
    const offset = (pageNum - 1) * limitNum;
    try {
        const { filters, params } = buildSearchFilters(tenantId, req.query);
        const dbResult = await db_1.default.query(`SELECT * FROM candidates WHERE ${filters.join(" AND ")} ORDER BY created_at DESC`, params);
        // Parse query into individual search terms, stripping boolean operators
        const queryStr = String(rawQuery ?? "").trim();
        const queryTerms = queryStr.length === 0
            ? []
            : queryStr
                .toLowerCase()
                .split(/\s+(?:AND|OR|NOT)\s+|\s+/i)
                .map((t) => t.replace(/[()]/g, "").trim())
                .filter(Boolean);
        let withScores;
        if (queryTerms.length === 0) {
            // No query — return everything, score 100
            withScores = dbResult.rows.map((c) => ({ candidate: c, score: 100 }));
        }
        else {
            withScores = dbResult.rows
                .map((c) => ({ candidate: c, score: scoreCandidate(c, queryTerms) }))
                .filter((r) => r.score > 55)
                .sort((a, b) => b.score - a.score);
        }
        const total = withScores.length;
        const paginated = withScores.slice(offset, offset + limitNum);
        return res.json({
            results: paginated,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1,
        });
    }
    catch (error) {
        console.error("[searchCandidates] Error:", error?.message);
        console.error("[searchCandidates] Stack:", error?.stack);
        return res.status(500).json({
            message: "Search failed",
            error: process.env.NODE_ENV !== "production" ? error?.message : undefined,
        });
    }
};
exports.searchCandidates = searchCandidates;
// ─── export ─────────────────────────────────────────────────────────────────
const exportCandidates = async (req, res) => {
    const tenantId = req.user?.tenant_id;
    try {
        const { filters, params } = buildSearchFilters(tenantId, req.query);
        const dbResult = await db_1.default.query(`SELECT first_name, last_name, email, phone, current_title, current_company,
              experience_years, current_location, notice_period_days, expected_ctc,
              skills, source, created_at
       FROM candidates
       WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC`, params);
        const rows = dbResult.rows.map((r) => ({
            ...r,
            skills: Array.isArray(r.skills) ? r.skills.join(", ") : r.skills,
        }));
        // Lazy require avoids module-level import issues with json2csv v5 (see git: "fix: import issue of json2csv")
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Parser: CsvParser } = require("json2csv");
        const parser = new CsvParser({
            fields: [
                "first_name",
                "last_name",
                "email",
                "phone",
                "current_title",
                "current_company",
                "experience_years",
                "current_location",
                "notice_period_days",
                "expected_ctc",
                "skills",
                "source",
                "created_at",
            ],
        });
        const csv = parser.parse(rows);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="candidates_export.csv"');
        res.send(csv);
    }
    catch (error) {
        console.error("Export candidates error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.exportCandidates = exportCandidates;
