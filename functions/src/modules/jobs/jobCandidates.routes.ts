import { Router } from "express";
import { createCandidateForJob } from "../candidates/candidates.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import { candidateUpload } from "../../middleware/candidateUpload";

const router = Router();

const candidateWriteRoles = [
  "super_admin",
  "accounts_manager",
  "recruiter",
  "vendor_manager",
  "vendor_user",
];

// POST /v1/jobs/:jobId/candidates — create candidate and link to job in one step
router.post(
  "/:jobId/candidates",
  authMiddleware,
  tenantIsolation,
  authorize(candidateWriteRoles),
  candidateUpload,
  createCandidateForJob,
);

export default router;
