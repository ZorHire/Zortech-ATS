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

export default router;
