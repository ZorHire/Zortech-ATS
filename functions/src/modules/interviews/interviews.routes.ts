import { Router } from "express";
import * as interviewController from "./interviews.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const writeRoles = ["super_admin", "accounts_manager", "recruiter", "vendor_manager"];

router.post("/", authMiddleware, tenantIsolation, authorize(writeRoles), interviewController.createInterview);
router.get("/applications/:applicationId", authMiddleware, tenantIsolation, interviewController.getInterviewsByApplication);
router.patch("/:id", authMiddleware, tenantIsolation, authorize(writeRoles), interviewController.updateInterview);
router.delete("/:id", authMiddleware, tenantIsolation, authorize(writeRoles), interviewController.deleteInterview);

export default router;
