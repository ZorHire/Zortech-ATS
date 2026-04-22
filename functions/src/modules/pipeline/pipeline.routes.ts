import { Router } from "express";
import * as pipelineController from "./pipeline.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const recruiterRoles = ["super_admin", "accounts_manager", "recruiter"];

router.post("/add", authMiddleware, tenantIsolation, authorize(recruiterRoles), pipelineController.addToPipeline);

router.get("/jobs/:jobId/applications", authMiddleware, tenantIsolation, pipelineController.getJobApplications);
router.post("/jobs/:jobId/applications", authMiddleware, tenantIsolation, authorize(recruiterRoles), pipelineController.createApplication);
router.patch("/applications/:id/stage", authMiddleware, tenantIsolation, authorize(recruiterRoles), pipelineController.moveApplicationStage);
router.get("/applications/:id/history", authMiddleware, tenantIsolation, pipelineController.getApplicationHistory);

export default router;
