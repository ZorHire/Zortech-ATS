import { Router } from "express";
import * as candidateController from "./candidates.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import { upload } from "../../middleware/fileUpload";

const router = Router();

const recruiterRoles = ["super_admin", "ats_admin", "senior_recruiter", "recruiter", "sourcing_specialist"];

router.get("/", authMiddleware, tenantIsolation, candidateController.getCandidates);
router.get("/:id", authMiddleware, tenantIsolation, candidateController.getCandidateById);
router.post("/", authMiddleware, tenantIsolation, authorize(recruiterRoles), upload.single("resume"), candidateController.createCandidate);
router.patch("/:id", authMiddleware, tenantIsolation, authorize(recruiterRoles), upload.single("resume"), candidateController.updateCandidate);
router.delete("/:id", authMiddleware, tenantIsolation, authorize(recruiterRoles), candidateController.deleteCandidate);

export default router;
