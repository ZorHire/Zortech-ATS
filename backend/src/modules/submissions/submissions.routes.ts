import { Router } from "express";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import * as s from "./submissions.controller";

const STAFF = ["super_admin", "accounts_manager", "vendor_manager", "recruiter"];

/** Client submission packs: /v1/submissions/* */
const router = Router();
router.use(authMiddleware, tenantIsolation, authorize(STAFF));
router.get("/applications/:id", s.getSubmission);
router.post("/applications/:id/generate", s.generateSubmission);
router.put("/applications/:id", s.saveSubmission);
router.post("/applications/:id/send", s.sendSubmission);
export default router;
