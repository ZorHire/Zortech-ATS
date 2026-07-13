import { Router } from "express";
import * as controller from "./vendor-portal.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const VENDOR_ROLE = ["vendor_user"];
const MANAGE_ROLES = ["super_admin", "accounts_manager", "vendor_manager"];

router.get("/profile",     authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.getVendorProfile);
router.get("/jobs",        authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.getAssignedJobs);
router.get("/jobs/:id",    authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.getJobDetail);
router.post("/submit",     authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.submitCandidate);
router.get("/submissions", authMiddleware, tenantIsolation, authorize(VENDOR_ROLE), controller.getSubmissions);

// Admin: list all submissions + set rejection reason
router.get("/all-submissions",               authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), controller.getAllSubmissions);
router.patch("/submissions/:id/reject",      authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), controller.rejectSubmission);

export default router;
