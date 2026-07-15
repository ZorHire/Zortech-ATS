import { Router } from "express";
import * as controller from "./client-portal.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const ADMIN_ROLES = ["super_admin", "accounts_manager"];
const CLIENT_ROLE = ["client_user"];

// ── Admin management routes ──────────────────────────────────────────────────
router.get(
  "/admin/users",
  authMiddleware, tenantIsolation, authorize(ADMIN_ROLES),
  controller.listClientUsers,
);
router.post(
  "/admin/users",
  authMiddleware, tenantIsolation, authorize(ADMIN_ROLES),
  controller.createClientUser,
);
router.post(
  "/admin/jobs/:jobId/grant",
  authMiddleware, tenantIsolation, authorize(ADMIN_ROLES),
  controller.grantJobAccess,
);
router.delete(
  "/admin/jobs/:jobId/revoke",
  authMiddleware, tenantIsolation, authorize(ADMIN_ROLES),
  controller.revokeJobAccess,
);

// ── Client-facing routes ─────────────────────────────────────────────────────
router.get(
  "/profile",
  authMiddleware, tenantIsolation, authorize(CLIENT_ROLE),
  controller.getClientProfile,
);
router.get(
  "/jobs",
  authMiddleware, tenantIsolation, authorize(CLIENT_ROLE),
  controller.getAccessibleJobs,
);
router.get(
  "/jobs/:jobId/candidates",
  authMiddleware, tenantIsolation, authorize(CLIENT_ROLE),
  controller.getJobCandidates,
);
router.post(
  "/candidates/:applicationId/feedback",
  authMiddleware, tenantIsolation, authorize(CLIENT_ROLE),
  controller.submitFeedback,
);

export default router;
