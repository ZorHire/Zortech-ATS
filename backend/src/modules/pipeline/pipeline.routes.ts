import { Router } from "express";
import * as pipelineController from "./pipeline.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";
import { createScreeningInvite } from "../screening/screening.controller";

const router = Router();

router.post(
  "/add",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "accounts_manager",
    "recruiter",
  ]),
  pipelineController.addToPipeline,
);

router.get(
  "/candidates/:candidateId/applications",
  authMiddleware,
  tenantIsolation,
  pipelineController.getCandidateApplications,
);
router.get(
  "/jobs/:jobId/applications",
  authMiddleware,
  tenantIsolation,
  pipelineController.getJobApplications,
);
router.post(
  "/jobs/:jobId/applications",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "accounts_manager",
    "recruiter",
  ]),
  pipelineController.createApplication,
);
router.patch(
  "/applications/:id/stage",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "accounts_manager",
    "recruiter",
  ]),
  pipelineController.moveApplicationStage,
);
router.get(
  "/applications/:id/history",
  authMiddleware,
  tenantIsolation,
  pipelineController.getApplicationHistory,
);
router.post(
  "/applications/:id/screening-invite",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "recruiter"]),
  createScreeningInvite,
);

export default router;
