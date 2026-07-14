import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { withCache, invalidate } from "../../lib/cache";
import { embedText } from "../../services/embedding";
import { scoreCandidateForJob } from "../../services/scoring";
import { mapWithConcurrency } from "../../lib/concurrency";
import { applyAiStageMove } from "../pipeline/pipeline.controller";

const SHORTLIST_THRESHOLD = 75;
const SCORING_CONCURRENCY = 4;
const PRE_SHORTLIST_STAGES = ["new", "sourced", "screened"];

export const runJobShortlisting = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;

  try {
    const jobResult = await pool.query(
      `SELECT title, mandatory_skills, preferred_skills, description FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }
    const job = jobResult.rows[0];

    const appsResult = await pool.query(
      `SELECT ja.id AS application_id, ja.stage AS current_stage,
              c.current_title, c.current_company, c.experience_years, c.skills,
              c.notice_period_days, c.current_ctc, c.expected_ctc, c.summary
       FROM job_applications ja
       JOIN candidates c ON c.id = ja.candidate_id
       WHERE ja.job_id = $1 AND ja.tenant_id = $2 AND ja.stage = ANY($3) AND c.deleted_at IS NULL`,
      [id, tenantId, PRE_SHORTLIST_STAGES],
    );

    const results = await mapWithConcurrency(appsResult.rows, SCORING_CONCURRENCY, async (row) => {
      const scoreResult = await scoreCandidateForJob(job, row, tenantId!, row.application_id);
      if (!scoreResult) {
        return { application_id: row.application_id, scored: false, shortlisted: false };
      }

      await pool.query(
        `UPDATE job_applications SET ai_score = $1, ai_match_breakdown = $2::jsonb, updated_at = now() WHERE id = $3`,
        [scoreResult.score, JSON.stringify(scoreResult.breakdown), row.application_id],
      );

      let shortlisted = false;
      if (scoreResult.score >= SHORTLIST_THRESHOLD) {
        await applyAiStageMove({
          tenantId: tenantId!,
          applicationId: row.application_id,
          fromStage: row.current_stage,
          toStage: "shortlisted",
          note: `Auto-shortlisted by AI — score ${scoreResult.score}/100`,
        });
        shortlisted = true;
      }
      return { application_id: row.application_id, scored: true, score: scoreResult.score, shortlisted };
    });

    res.json({
      total_eligible: appsResult.rows.length,
      scored: results.filter((r) => r.scored).length,
      shortlisted: results.filter((r) => r.shortlisted).length,
      results,
    });
  } catch (error) {
    console.error("Run job shortlisting error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getJobMatches = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;

  try {
    const jobResult = await pool.query(
      `SELECT title, mandatory_skills, preferred_skills, description FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }
    const job = jobResult.rows[0];

    const queryText = [
      job.title,
      [...(job.mandatory_skills || []), ...(job.preferred_skills || [])].join(", "),
      job.description,
    ].filter(Boolean).join(". ");

    const queryEmbedding = await embedText(queryText, "RETRIEVAL_QUERY", tenantId!, "job");
    if (!queryEmbedding) {
      return res.status(503).json({
        message: "Matching is temporarily unavailable — could not generate a query embedding for this job",
      });
    }

    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const result = await pool.query(
      `SELECT id, first_name, last_name, current_title, current_location, skills,
              1 - (embedding <=> $1::vector) AS similarity
       FROM candidates
       WHERE tenant_id = $2 AND deleted_at IS NULL AND is_active = true AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 30`,
      [vectorLiteral, tenantId],
    );

    res.json({ matches: result.rows });
  } catch (error) {
    console.error("Get job matches error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getJobs = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const rows = await withCache(`tenant:${tenantId}:jobs`, 120, async () => {
      const result = await pool.query(
        `SELECT j.*, json_build_object('id', c.id, 'name', c.name, 'tier', c.tier) AS client,
                (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id AND ja.tenant_id = $1) AS application_count
         FROM jobs j
         JOIN clients c ON c.id = j.client_id
         WHERE j.tenant_id = $1 AND j.deleted_at IS NULL
         ORDER BY j.created_at DESC`,
        [tenantId],
      );
      return result.rows;
    });
    res.json(rows);
  } catch (error) {
    console.error("Get jobs error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getJobById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT j.*, json_build_object('id', c.id, 'name', c.name, 'tier', c.tier) AS client
       FROM jobs j
       JOIN clients c ON c.id = j.client_id
       WHERE j.id = $1 AND j.tenant_id = $2 AND j.deleted_at IS NULL`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get job error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createJob = async (req: AuthRequest, res: Response) => {
  const {
    client_id,
    title,
    department,
    location,
    work_mode,
    employment_type,
    experience_min,
    experience_max,
    salary_min,
    salary_max,
    currency,
    headcount,
    priority,
    status,
    description,
    mandatory_skills,
    preferred_skills,
    assigned_recruiter_id,
    target_start_date,
  } = req.body;
  const createdBy = req.user?.id;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `INSERT INTO jobs (tenant_id, client_id, title, department, location, work_mode, employment_type, experience_min, experience_max, salary_min, salary_max, currency, headcount, priority, status, description, mandatory_skills, preferred_skills, assigned_recruiter_id, target_start_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING *`,
      [
        tenantId,
        client_id,
        title,
        department,
        location,
        work_mode || "onsite",
        employment_type || "full_time",
        experience_min || 0,
        experience_max || 10,
        salary_min,
        salary_max,
        currency || "INR",
        headcount || 1,
        priority || "medium",
        status || "draft",
        description,
        mandatory_skills || [],
        preferred_skills || [],
        assigned_recruiter_id,
        target_start_date,
        createdBy,
      ],
    );
    await invalidate(`tenant:${tenantId}:jobs`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create job error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateJob = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    title,
    department,
    location,
    work_mode,
    employment_type,
    experience_min,
    experience_max,
    salary_min,
    salary_max,
    currency,
    headcount,
    priority,
    status,
    description,
    mandatory_skills,
    preferred_skills,
    assigned_recruiter_id,
    target_start_date,
  } = req.body;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `UPDATE jobs SET 
       title = COALESCE($1, title),
       department = COALESCE($2, department),
       location = COALESCE($3, location),
       work_mode = COALESCE($4, work_mode),
       employment_type = COALESCE($5, employment_type),
       experience_min = COALESCE($6, experience_min),
       experience_max = COALESCE($7, experience_max),
       salary_min = COALESCE($8, salary_min),
       salary_max = COALESCE($9, salary_max),
       currency = COALESCE($10, currency),
       headcount = COALESCE($11, headcount),
       priority = COALESCE($12, priority),
       status = COALESCE($13, status),
       description = COALESCE($14, description),
       mandatory_skills = COALESCE($15, mandatory_skills),
       preferred_skills = COALESCE($16, preferred_skills),
       assigned_recruiter_id = COALESCE($17, assigned_recruiter_id),
       target_start_date = COALESCE($18, target_start_date),
       updated_at = now()
       WHERE id = $19 AND tenant_id = $20 AND deleted_at IS NULL
       RETURNING *`,
      [
        title,
        department,
        location,
        work_mode,
        employment_type,
        experience_min,
        experience_max,
        salary_min,
        salary_max,
        currency,
        headcount,
        priority,
        status,
        description,
        mandatory_skills,
        preferred_skills,
        assigned_recruiter_id,
        target_start_date,
        id,
        tenantId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }
    await invalidate(`tenant:${tenantId}:jobs`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update job error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteJob = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      "UPDATE jobs SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }
    await invalidate(`tenant:${tenantId}:jobs`);
    res.json({ message: "Job deleted successfully" });
  } catch (error) {
    console.error("Delete job error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
