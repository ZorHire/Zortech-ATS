import { Router, Response } from "express";
import pool from "../db";
import { AuthRequest, authMiddleware, authorize } from "../middleware/auth";
import { draftOutreach } from "../services/outreachWriter";
import { buildBiasStrippedCandidate } from "../services/scoring";

const router = Router();

const TONES = ["formal", "friendly", "brief"] as const;
type Tone = (typeof TONES)[number];

router.post(
  "/draft-outreach",
  authMiddleware,
  authorize(["recruiter", "admin"]),
  async (req: AuthRequest, res: Response) => {
    const { jobId, candidateId, tone, salutationName, salaryRange } = req.body ?? {};
    const tenantId = req.user!.tenant_id;

    if (!jobId || !candidateId) {
      return res.status(400).json({ message: "jobId and candidateId are required" });
    }
    if (tone && !TONES.includes(tone as Tone)) {
      return res.status(400).json({ message: `tone must be one of: ${TONES.join(", ")}` });
    }

    try {
      const [jobResult, candidateResult, senderResult] = await Promise.all([
        pool.query(
          `SELECT title, mandatory_skills, preferred_skills, description
             FROM jobs
            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [jobId, tenantId],
        ),
        pool.query(
          `SELECT current_title, current_company, experience_years, skills,
                  notice_period_days, current_ctc, expected_ctc, summary
             FROM candidates
            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [candidateId, tenantId],
        ),
        pool.query(
          `SELECT p.full_name, t.name AS company_name
             FROM tenants t
             LEFT JOIN profiles p ON p.id = $2
            WHERE t.id = $1`,
          [tenantId, req.user!.id],
        ),
      ]);

      if (jobResult.rows.length === 0) {
        return res.status(404).json({ message: "Job not found" });
      }
      if (candidateResult.rows.length === 0) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      // The model never sees the candidate's name — the salutation is
      // interpolated after generation, same posture as scoring.
      const candidate = buildBiasStrippedCandidate(candidateResult.rows[0]);
      const sender = senderResult.rows[0] ?? {};

      const draft = await draftOutreach(
        jobResult.rows[0],
        candidate,
        (tone as Tone) ?? "friendly",
        sender.full_name || "the hiring team",
        sender.company_name || "our company",
        typeof salutationName === "string" ? salutationName.slice(0, 100) : "there",
        tenantId,
        candidateId,
        typeof salaryRange === "string" ? salaryRange : undefined,
      );

      if (!draft) {
        return res.status(503).json({
          message: "Outreach drafting is temporarily unavailable",
        });
      }

      return res.json(draft);
    } catch (err) {
      console.error(
        "[EmailCampaigns] draft-outreach failed:",
        err instanceof Error ? err.message : err,
      );
      return res.status(500).json({ message: "Failed to draft outreach" });
    }
  },
);

export default router;
