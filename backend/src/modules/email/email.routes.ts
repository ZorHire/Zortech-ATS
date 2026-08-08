import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as emailController from "./email.controller";
import {
  handleOpenPixel,
  handleClickRedirect,
  handleUnsubscribe,
  listUnsubscribes,
  removeUnsubscribe,
} from "./email-tracking.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";

// Prevent bulk unsubscribe-link scraping / abuse
const unsubscribeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

const EMAIL_ROLES = ["super_admin", "accounts_manager", "recruiter", "vendor_manager"];

// ─── Per-user SMTP config ─────────────────────────────────────────────────────

router.get(
  "/config",
  authMiddleware,
  tenantIsolation,
  authorize(EMAIL_ROLES),
  emailController.getEmailConfig,
);

router.post(
  "/config",
  authMiddleware,
  tenantIsolation,
  authorize(EMAIL_ROLES),
  emailController.saveEmailConfig,
);

router.delete(
  "/config",
  authMiddleware,
  tenantIsolation,
  authorize(EMAIL_ROLES),
  emailController.removeEmailConfig,
);

router.post(
  "/config/test",
  authMiddleware,
  tenantIsolation,
  authorize(EMAIL_ROLES),
  emailController.testEmailConfig,
);

// ─── Email sending ────────────────────────────────────────────────────────────

router.get(
  "/templates",
  authMiddleware,
  tenantIsolation,
  emailController.listTemplates,
);

router.post(
  "/send-single",
  authMiddleware,
  tenantIsolation,
  authorize(EMAIL_ROLES),
  emailController.sendSingleEmail,
);

router.post(
  "/send",
  authMiddleware,
  tenantIsolation,
  authorize(EMAIL_ROLES),
  emailController.sendEmail,
);

router.post(
  "/assign-jd",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "vendor_manager"]),
  emailController.assignJd,
);

router.post(
  "/assign-jd-recruiter",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager"]),
  emailController.assignJdRecruiter,
);

// ─── Tracking — public (no auth, called by email clients / recipients) ────────

router.get("/track/open/:trackingId",   handleOpenPixel);
router.get("/track/click/:trackingId",  handleClickRedirect);
router.get("/unsubscribe/:trackingId",  unsubscribeLimiter, handleUnsubscribe);

// ─── Unsubscribe list management (authenticated) ──────────────────────────────

router.get(
  "/unsubscribes",
  authMiddleware,
  tenantIsolation,
  listUnsubscribes,
);

router.delete(
  "/unsubscribes/:email",
  authMiddleware,
  tenantIsolation,
  removeUnsubscribe,
);

export default router;
