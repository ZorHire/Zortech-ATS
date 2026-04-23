import { Router } from "express";
import * as candidateController from "./candidates.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import { candidateUpload } from "../../middleware/candidateUpload";

const router = Router();

// All roles that can create/update/delete candidates.
// vendor_user update/delete is further restricted in the controller to their assigned JDs.
const candidateWriteRoles = ["super_admin", "accounts_manager", "recruiter", "vendor_manager", "vendor_user"];

// These must come BEFORE /:id to prevent Express matching "search"/"export" as an id param
router.get("/search", authMiddleware, tenantIsolation, candidateController.searchCandidates);
router.get("/export", authMiddleware, tenantIsolation, candidateController.exportCandidates);

router.get("/", authMiddleware, tenantIsolation, candidateController.getCandidates);
router.get("/:id/resume", authMiddleware, tenantIsolation, candidateController.getResumeFile);
router.get("/:id", authMiddleware, tenantIsolation, candidateController.getCandidateById);
router.post("/", authMiddleware, tenantIsolation, authorize(candidateWriteRoles), candidateUpload, candidateController.createCandidate);
router.patch("/:id", authMiddleware, tenantIsolation, authorize(candidateWriteRoles), candidateUpload, candidateController.updateCandidate);
router.delete("/:id", authMiddleware, tenantIsolation, authorize(candidateWriteRoles), candidateController.deleteCandidate);

export default router;
