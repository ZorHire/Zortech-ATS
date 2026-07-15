import { Router } from "express";
import * as candidateController from "./candidates.controller";
import * as gdpr from "./gdpr.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";
import { upload } from "../../middleware/fileUpload";

const router = Router();

router.get(
  "/search",
  authMiddleware,
  tenantIsolation,
  candidateController.searchCandidates,
);

router.get(
  "/export",
  authMiddleware,
  tenantIsolation,
  candidateController.exportCandidates,
);

router.get(
  "/search-history",
  authMiddleware,
  tenantIsolation,
  candidateController.getSearchHistory,
);

// Static GDPR route must be above /:id wildcard
router.get("/deletion-requests", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), gdpr.listDeletionRequests);

router.get(
  "/",
  authMiddleware,
  tenantIsolation,
  candidateController.getCandidates,
);
router.get(
  "/:id/pipeline",
  authMiddleware,
  tenantIsolation,
  candidateController.getCandidateTimeline,
);
router.get(
  "/:id/resume",
  authMiddleware,
  tenantIsolation,
  candidateController.getResume,
);
router.get(
  "/:id",
  authMiddleware,
  tenantIsolation,
  candidateController.getCandidateById,
);
router.post(
  "/",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "accounts_manager",
    "recruiter",
  ]),
  upload.single("resume"),
  candidateController.createCandidate,
);
router.patch(
  "/:id",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "accounts_manager",
    "recruiter",
  ]),
  upload.single("resume"),
  candidateController.updateCandidate,
);
router.delete(
  "/:id",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "accounts_manager",
    "recruiter",
  ]),
  candidateController.deleteCandidate,
);

// GDPR right-to-erasure: permanently anonymise all PII (super_admin only)
router.delete(
  "/:id/purge",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin"]),
  candidateController.purgeCandidatePII,
);

// Engagement history: pipeline events + interviews + logged activities
router.get(
  "/:id/engagement",
  authMiddleware,
  tenantIsolation,
  candidateController.getCandidateEngagement,
);

// Log a manual engagement event (call, note, etc.)
router.post(
  "/:id/engagement",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "recruiter"]),
  candidateController.logEngagementEvent,
);

router.patch("/:id/gdpr-consent", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), gdpr.updateGdprConsent);
router.post("/:id/request-deletion", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), gdpr.requestDeletion);
router.post("/:id/anonymize", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), gdpr.anonymizeCandidate);

export default router;
