"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApplicationHistory = exports.getCandidateApplications = exports.addToPipeline = exports.moveApplicationStage = exports.createApplication = exports.getJobApplications = void 0;
const db_1 = __importDefault(require("../../db"));
const allowedStages = [
    "new",
    "sourced",
    "screened",
    "shortlisted",
    "submitted_to_client",
    "client_interview_scheduled",
    "interview_completed",
    "selected",
    "offer_extended",
    "offer_accepted",
    "joined",
    "disqualified",
];
const normalizeStage = (value) => {
    if (allowedStages.includes(value)) {
        return value;
    }
    return "new";
};
const getJobApplications = async (req, res) => {
    const { jobId } = req.params;
    const tenantId = req.user?.tenant_id;
    try {
        const result = await db_1.default.query(`SELECT ja.*, json_build_object(
          'id', c.id,
          'first_name', c.first_name,
          'last_name', c.last_name,
          'email', c.email,
          'phone', c.phone,
          'current_title', c.current_title,
          'current_company', c.current_company,
          'current_location', c.current_location,
          'skills', c.skills,
          'resume_url', c.resume_url
        ) AS candidate
       FROM job_applications ja
       JOIN candidates c ON c.id = ja.candidate_id
       WHERE ja.job_id = $1 AND ja.tenant_id = $2
       ORDER BY ja.created_at ASC`, [jobId, tenantId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("Get job applications error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getJobApplications = getJobApplications;
const createApplication = async (req, res) => {
    const { jobId } = req.params;
    const { candidate_id, stage, notes, assigned_to } = req.body;
    const tenantId = req.user?.tenant_id;
    const createdBy = req.user?.id;
    if (!candidate_id) {
        return res.status(400).json({ message: "candidate_id is required" });
    }
    const targetStage = normalizeStage(stage || "new");
    try {
        const jobResult = await db_1.default.query("SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", [jobId, tenantId]);
        if (jobResult.rows.length === 0) {
            return res.status(404).json({ message: "Job not found" });
        }
        const candidateResult = await db_1.default.query("SELECT id FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", [candidate_id, tenantId]);
        if (candidateResult.rows.length === 0) {
            return res.status(404).json({ message: "Candidate not found" });
        }
        const existing = await db_1.default.query("SELECT id FROM job_applications WHERE tenant_id = $1 AND job_id = $2 AND candidate_id = $3", [tenantId, jobId, candidate_id]);
        if (existing.rows.length > 0) {
            return res
                .status(409)
                .json({ message: "Candidate is already added to this job" });
        }
        const insertResult = await db_1.default.query(`INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, notes, assigned_to, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING *`, [
            tenantId,
            jobId,
            candidate_id,
            targetStage,
            notes || null,
            assigned_to || null,
        ]);
        const application = insertResult.rows[0];
        await db_1.default.query(`INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`, [tenantId, application.id, null, targetStage, createdBy, notes || null]);
        res.status(201).json(application);
    }
    catch (error) {
        console.error("Create application error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createApplication = createApplication;
const moveApplicationStage = async (req, res) => {
    const { id } = req.params;
    const { to_stage, note } = req.body;
    const tenantId = req.user?.tenant_id;
    const changedBy = req.user?.id;
    const targetStage = normalizeStage(to_stage);
    try {
        const applicationResult = await db_1.default.query("SELECT * FROM job_applications WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
        if (applicationResult.rows.length === 0) {
            return res.status(404).json({ message: "Application not found" });
        }
        const currentStage = applicationResult.rows[0].stage;
        if (currentStage === targetStage) {
            return res
                .status(400)
                .json({ message: "Candidate is already in the requested stage" });
        }
        const updateResult = await db_1.default.query(`UPDATE job_applications SET stage = $1, updated_at = now() WHERE id = $2 RETURNING *`, [targetStage, id]);
        await db_1.default.query(`INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`, [tenantId, id, currentStage, targetStage, changedBy, note || null]);
        res.json(updateResult.rows[0]);
    }
    catch (error) {
        console.error("Move application stage error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.moveApplicationStage = moveApplicationStage;
const addToPipeline = async (req, res) => {
    const { candidateId, jobId } = req.body;
    const tenantId = req.user?.tenant_id;
    const createdBy = req.user?.id;
    if (!candidateId || !jobId) {
        return res
            .status(400)
            .json({ message: "candidateId and jobId are required" });
    }
    try {
        const jobResult = await db_1.default.query("SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", [jobId, tenantId]);
        if (jobResult.rows.length === 0) {
            return res.status(404).json({ message: "Job not found" });
        }
        const candidateResult = await db_1.default.query("SELECT id FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", [candidateId, tenantId]);
        if (candidateResult.rows.length === 0) {
            return res.status(404).json({ message: "Candidate not found" });
        }
        const existing = await db_1.default.query("SELECT id FROM job_applications WHERE tenant_id = $1 AND job_id = $2 AND candidate_id = $3", [tenantId, jobId, candidateId]);
        if (existing.rows.length > 0) {
            return res
                .status(409)
                .json({ message: "Candidate already in this pipeline" });
        }
        const insertResult = await db_1.default.query(`INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, created_at, updated_at)
       VALUES ($1, $2, $3, 'new', now(), now())
       RETURNING *`, [tenantId, jobId, candidateId]);
        const application = insertResult.rows[0];
        await db_1.default.query(`INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, created_at)
       VALUES ($1, $2, $3, $4, $5, now())`, [tenantId, application.id, null, "new", createdBy]);
        res.status(201).json(application);
    }
    catch (error) {
        console.error("Add to pipeline error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.addToPipeline = addToPipeline;
const getCandidateApplications = async (req, res) => {
    const { candidateId } = req.params;
    const tenantId = req.user?.tenant_id;
    try {
        const result = await db_1.default.query(`SELECT ja.*, json_build_object(
          'id', j.id,
          'title', j.title,
          'department', j.department
        ) AS job
       FROM job_applications ja
       JOIN jobs j ON j.id = ja.job_id
       WHERE ja.candidate_id = $1 AND ja.tenant_id = $2
       ORDER BY ja.updated_at DESC`, [candidateId, tenantId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("Get candidate applications error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCandidateApplications = getCandidateApplications;
const getApplicationHistory = async (req, res) => {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id;
    try {
        const result = await db_1.default.query(`SELECT pe.*, u.email as changed_by_email
       FROM pipeline_events pe
       LEFT JOIN users u ON u.id = pe.changed_by
       WHERE pe.application_id = $1 AND pe.tenant_id = $2
       ORDER BY pe.created_at ASC`, [id, tenantId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("Get application history error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getApplicationHistory = getApplicationHistory;
