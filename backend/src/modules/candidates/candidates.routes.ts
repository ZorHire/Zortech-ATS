import { Router } from "express";
import * as candidateController from "./candidates.controller";
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
  "/",
  authMiddleware,
  tenantIsolation,
  candidateController.getCandidates,
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

export default router;
