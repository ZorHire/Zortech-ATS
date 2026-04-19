import { Router } from "express";
import * as candidateController from "./candidates.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import { candidateUpload } from "../../middleware/candidateUpload";

const router = Router();

const recruiterRoles = ["super_admin", "ats_admin", "senior_recruiter", "recruiter", "sourcing_specialist"];

// These must come BEFORE /:id to prevent Express matching "search"/"export" as an id param
router.get("/search", authMiddleware, tenantIsolation, candidateController.searchCandidates);
router.get("/export", authMiddleware, tenantIsolation, candidateController.exportCandidates);

router.get("/", authMiddleware, tenantIsolation, candidateController.getCandidates);
router.get("/:id", authMiddleware, tenantIsolation, candidateController.getCandidateById);
router.post("/", authMiddleware, tenantIsolation, authorize(recruiterRoles), candidateUpload, candidateController.createCandidate);
router.patch("/:id", authMiddleware, tenantIsolation, authorize(recruiterRoles), candidateUpload, candidateController.updateCandidate);
router.delete("/:id", authMiddleware, tenantIsolation, authorize(recruiterRoles), candidateController.deleteCandidate);

export default router;
