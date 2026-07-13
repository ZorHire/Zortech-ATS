import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { withCache, invalidate } from "../../lib/cache";

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
    vendor_submission_limit,
  } = req.body;
  const createdBy = req.user?.id;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `INSERT INTO jobs (tenant_id, client_id, title, department, location, work_mode, employment_type, experience_min, experience_max, salary_min, salary_max, currency, headcount, priority, status, description, mandatory_skills, preferred_skills, assigned_recruiter_id, target_start_date, created_by, vendor_submission_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
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
        vendor_submission_limit ? Number(vendor_submission_limit) : null,
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
    vendor_submission_limit,
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
       vendor_submission_limit = COALESCE($19, vendor_submission_limit),
       updated_at = now()
       WHERE id = $20 AND tenant_id = $21 AND deleted_at IS NULL
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
        vendor_submission_limit !== undefined ? Number(vendor_submission_limit) : undefined,
        id,
        tenantId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }
    await invalidate(`tenant:${tenantId}:jobs`);
    (async()=>{
      try {
        const snap = await pool.query('SELECT * FROM jobs WHERE id=$1',[id]);
        if(snap.rows[0]){
          const maxV = await pool.query('SELECT COALESCE(MAX(version_number),0)+1 as n FROM job_versions WHERE job_id=$1',[id]);
          await pool.query('INSERT INTO job_versions(tenant_id,job_id,version_number,snapshot,changed_by)VALUES($1,$2,$3,$4,$5)',
            [tenantId,id,maxV.rows[0].n,snap.rows[0],req.user?.id]);
        }
      }catch(e){console.error('version-snapshot error:',e);}
    })();
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
