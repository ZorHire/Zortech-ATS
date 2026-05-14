import { Router } from "express";
import * as emailController from "./email.controller";
import * as emailConfigController from "./emailConfig.controller";
import * as tenantEmailConfigController from "./tenantEmailConfig.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

// ── Per-user SMTP config ────────────────────────────────────────────────────
// Every authenticated user in any tenant (recruiter, vendor_manager, vendor_user, etc.)
// can manage their own personal email config — no role restriction beyond being logged in.
router.get(
  "/config",
  authMiddleware,
  tenantIsolation,
  emailConfigController.getEmailConfig,
);

router.post(
  "/config",
  authMiddleware,
  tenantIsolation,
  emailConfigController.saveEmailConfig,
);

router.delete(
  "/config",
  authMiddleware,
  tenantIsolation,
  emailConfigController.deleteEmailConfig,
);

router.post(
  "/config/test",
  authMiddleware,
  tenantIsolation,
  emailConfigController.testEmailConfig,
);

// ── Per-tenant SMTP config (admin only) ────────────────────────────────────
const adminRoles = ["super_admin", "accounts_manager"];

router.get(
  "/tenant-config",
  authMiddleware,
  tenantIsolation,
  authorize(adminRoles),
  tenantEmailConfigController.getTenantEmailConfig,
);

router.post(
  "/tenant-config",
  authMiddleware,
  tenantIsolation,
  authorize(adminRoles),
  tenantEmailConfigController.saveTenantEmailConfig,
);

router.delete(
  "/tenant-config",
  authMiddleware,
  tenantIsolation,
  authorize(adminRoles),
  tenantEmailConfigController.deleteTenantEmailConfig,
);

router.post(
  "/tenant-config/test",
  authMiddleware,
  tenantIsolation,
  authorize(adminRoles),
  tenantEmailConfigController.testTenantEmailConfig,
);

const sendRoles = ["super_admin", "accounts_manager", "recruiter"];

// ── Email sending & templates ───────────────────────────────────────────────
router.get(
  "/templates",
  authMiddleware,
  tenantIsolation,
  authorize(sendRoles),
  emailController.listTemplates,
);

router.post(
  "/send",
  authMiddleware,
  tenantIsolation,
  authorize(sendRoles),
  emailController.sendEmail,
);

router.post(
  "/send-single",
  authMiddleware,
  tenantIsolation,
  authorize(sendRoles),
  emailController.sendSingleEmail,
);

// Vendor Manager / Accounts Manager assigns a JD to a vendor
router.post(
  "/assign-jd",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "vendor_manager", "accounts_manager"]),
  emailController.assignJd,
);

// Accounts Manager assigns a JD to a recruiter
router.post(
  "/assign-jd-recruiter",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager"]),
  emailController.assignJdToRecruiter,
);

export default router;
