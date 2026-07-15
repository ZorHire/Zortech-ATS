import { Router } from "express";
import {
  submitForReview,
  approveJob,
  rejectJob,
  getJobApproval,
  getJobVersions,
  getPendingApprovals,
} from "./jd-lifecycle.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const APPROVERS = ["super_admin", "accounts_manager"] as const;
const SUBMITTERS = ["super_admin", "accounts_manager", "recruiter", "vendor_manager"] as const;

// Pending approvals list (admin/AM only)
router.get(
  "/pending",
  authMiddleware,
  tenantIsolation,
  authorize([...APPROVERS]),
  getPendingApprovals,
);

// Per-job routes
router.post(
  "/jobs/:id/submit-for-review",
  authMiddleware,
  tenantIsolation,
  authorize([...SUBMITTERS]),
  submitForReview,
);

router.post(
  "/jobs/:id/approve",
  authMiddleware,
  tenantIsolation,
  authorize([...APPROVERS]),
  approveJob,
);

router.post(
  "/jobs/:id/reject",
  authMiddleware,
  tenantIsolation,
  authorize([...APPROVERS]),
  rejectJob,
);

router.get(
  "/jobs/:id/approval",
  authMiddleware,
  tenantIsolation,
  getJobApproval,
);

router.get(
  "/jobs/:id/versions",
  authMiddleware,
  tenantIsolation,
  getJobVersions,
);

export default router;
