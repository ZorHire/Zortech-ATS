import { Router } from "express";
import * as controller from "./vendor-portal.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const VENDOR_ROLE = ["vendor_user"];

router.get("/profile",     authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.getVendorProfile);
router.get("/jobs",        authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.getAssignedJobs);
router.get("/jobs/:id",    authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.getJobDetail);
router.post("/submit",     authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.submitCandidate);
router.get("/submissions", authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.getSubmissions);

export default router;
