import { Router } from "express";
import * as interviewController from "./interviews.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";

const router = Router();

// List all interviews for the tenant (with optional query filters)
router.get(
  "/",
  authMiddleware,
  tenantIsolation,
  interviewController.listInterviews,
);

// Interviews for a specific pipeline application
router.get(
  "/applications/:appId",
  authMiddleware,
  tenantIsolation,
  interviewController.getApplicationInterviews,
);

// Schedule a new interview
router.post(
  "/",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "recruiter"]),
  interviewController.createInterview,
);

// Update interview status / feedback
router.patch(
  "/:id",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "recruiter"]),
  interviewController.updateInterview,
);

export default router;
