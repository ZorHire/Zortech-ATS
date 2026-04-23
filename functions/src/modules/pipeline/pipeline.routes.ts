import { Router } from "express";
import * as pipelineController from "./pipeline.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const recruiterRoles = ["super_admin", "accounts_manager", "recruiter"];
// vendor_manager and vendor_user can add candidates to pipeline.
// vendor_user is further restricted in the controller to assigned jobs only.
const pipelineWriteRoles = [...recruiterRoles, "vendor_manager", "vendor_user"];

router.post("/add", authMiddleware, tenantIsolation, authorize(pipelineWriteRoles), pipelineController.addToPipeline);

router.get("/jobs/:jobId/applications", authMiddleware, tenantIsolation, pipelineController.getJobApplications);
router.post("/jobs/:jobId/applications", authMiddleware, tenantIsolation, authorize(pipelineWriteRoles), pipelineController.createApplication);
router.patch("/applications/:id/stage", authMiddleware, tenantIsolation, authorize(recruiterRoles), pipelineController.moveApplicationStage);
router.get("/applications/:id/history", authMiddleware, tenantIsolation, pipelineController.getApplicationHistory);

export default router;
