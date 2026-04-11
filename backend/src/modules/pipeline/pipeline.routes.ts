import { Router } from "express";
import * as pipelineController from "./pipeline.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";

const router = Router();

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
    "senior_recruiter",
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
    "senior_recruiter",
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
