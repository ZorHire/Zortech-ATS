import { Router } from "express";
import * as jobController from "./jobs.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";
import * as jdVersions from "./jd-versions.controller";
import * as jdApproval from "./jd-approval.controller";

const router = Router();

router.get("/", authMiddleware, tenantIsolation, jobController.getJobs);
// Static routes MUST come before /:id to avoid being swallowed by the wildcard
router.get("/pending-approval", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), jdApproval.listPendingApprovals);
router.get("/:id", authMiddleware, tenantIsolation, jobController.getJobById);
router.post("/:id/matches", authMiddleware, tenantIsolation, jobController.getJobMatches);
router.post(
  "/:id/shortlist",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "recruiter"]),
  jobController.runJobShortlisting,
);
router.post(
  "/",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "vendor_manager", "recruiter"]),
  jobController.createJob,
);
router.patch(
  "/:id",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "vendor_manager", "recruiter"]),
  jobController.updateJob,
);
router.delete(
  "/:id",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "vendor_manager", "recruiter"]),
  jobController.deleteJob,
);

// JD Versioning
router.get("/:jobId/versions", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), jdVersions.listJobVersions);
router.get("/:jobId/versions/:versionId", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), jdVersions.getJobVersion);
router.post("/:jobId/versions/:versionId/rollback", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), jdVersions.rollbackJobVersion);

// JD Approval (non-wildcard routes registered above /:id — see top of file)
router.post("/:id/submit-for-approval", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), jdApproval.submitForApproval);
router.post("/:id/approve", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), jdApproval.approveJob);
router.post("/:id/reject", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), jdApproval.rejectJob);

export default router;
