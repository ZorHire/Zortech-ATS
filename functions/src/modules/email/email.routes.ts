import { Router } from "express";
import * as emailController from "./email.controller";
import * as emailConfigController from "./emailConfig.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const recruiterRoles = [
  "super_admin",
  "accounts_manager",
  "recruiter",
];

// ── Per-user SMTP config ────────────────────────────────────────────────────
// Any recruiter-role user can manage their own email config.
router.get(
  "/config",
  authMiddleware,
  tenantIsolation,
  authorize(recruiterRoles),
  emailConfigController.getEmailConfig,
);

router.post(
  "/config",
  authMiddleware,
  tenantIsolation,
  authorize(recruiterRoles),
  emailConfigController.saveEmailConfig,
);

router.delete(
  "/config",
  authMiddleware,
  tenantIsolation,
  authorize(recruiterRoles),
  emailConfigController.deleteEmailConfig,
);

router.post(
  "/config/test",
  authMiddleware,
  tenantIsolation,
  authorize(recruiterRoles),
  emailConfigController.testEmailConfig,
);

// ── Email sending & templates ───────────────────────────────────────────────
router.get(
  "/templates",
  authMiddleware,
  tenantIsolation,
  authorize(recruiterRoles),
  emailController.listTemplates,
);

router.post(
  "/send",
  authMiddleware,
  tenantIsolation,
  authorize(recruiterRoles),
  emailController.sendEmail,
);

router.post(
  "/send-single",
  authMiddleware,
  tenantIsolation,
  authorize(recruiterRoles),
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
