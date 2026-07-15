import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const listJobVersions = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { jobId } = req.params;
  try {
    const result = await pool.query(
      `SELECT jv.*, u.first_name || ' ' || u.last_name as changed_by_name
       FROM job_versions jv
       LEFT JOIN users u ON u.id = jv.changed_by
       WHERE jv.job_id = $1 AND jv.tenant_id = $2
       ORDER BY jv.version_number DESC`,
      [jobId, tenantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('listJobVersions error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getJobVersion = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { jobId, versionId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM job_versions WHERE id=$1 AND job_id=$2 AND tenant_id=$3',
      [versionId, jobId, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Version not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getJobVersion error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const rollbackJobVersion = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const { jobId, versionId } = req.params;
  try {
    const ver = await pool.query(
      'SELECT * FROM job_versions WHERE id=$1 AND job_id=$2 AND tenant_id=$3',
      [versionId, jobId, tenantId]
    );
    if (!ver.rows[0]) return res.status(404).json({ message: 'Version not found' });
    const snap = ver.rows[0].snapshot as Record<string, any>;

    // Save current state as a new version before rolling back
    const current = await pool.query('SELECT * FROM jobs WHERE id=$1 AND tenant_id=$2', [jobId, tenantId]);
    if (!current.rows[0]) return res.status(404).json({ message: 'Job not found' });
    const maxVer = await pool.query(
      'SELECT COALESCE(MAX(version_number),0)+1 as next FROM job_versions WHERE job_id=$1 AND tenant_id=$2',
      [jobId, tenantId]
    );
    await pool.query(
      `INSERT INTO job_versions (tenant_id, job_id, version_number, snapshot, changed_by, change_note)
       VALUES ($1,$2,$3,$4,$5,'Pre-rollback snapshot')`,
      [tenantId, jobId, maxVer.rows[0].next, current.rows[0], userId]
    );

    // Apply the snapshot fields back to the jobs row
    const allowed = ['title','description','requirements','skills','location','work_mode','department','budget_min','budget_max','headcount','priority'];
    const sets: string[] = [];
    const vals: any[] = [jobId, tenantId];
    let i = 3;
    for (const key of allowed) {
      if (snap[key] !== undefined) { sets.push(`${key}=$${i++}`); vals.push(snap[key]); }
    }
    if (sets.length > 0) {
      sets.push(`updated_at=now()`);
      await pool.query(`UPDATE jobs SET ${sets.join(',')} WHERE id=$1 AND tenant_id=$2`, vals);
    }
    res.json({ message: 'Rolled back to version ' + ver.rows[0].version_number });
  } catch (err) {
    console.error('rollbackJobVersion error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
