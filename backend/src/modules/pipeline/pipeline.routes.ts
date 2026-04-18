import { Router } from "express";
import * as pipelineController from "./pipeline.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";

const router = Router();

router.post(
  "/add",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "ats_admin",
    "vendor_manager",
    "recruiter",
    "sourcing_specialist",
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
    "ats_admin",
    "vendor_manager",
    "recruiter",
    "sourcing_specialist",
  ]),
  pipelineController.createApplication,
);
router.patch(
  "/applications/:id/stage",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "ats_admin",
    "vendor_manager",
    "recruiter",
    "sourcing_specialist",
  ]),
  pipelineController.moveApplicationStage,
);
router.get(
  "/applications/:id/history",
  authMiddleware,
  tenantIsolation,
  pipelineController.getApplicationHistory,
);

export default router;
