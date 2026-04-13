import { Router } from "express";
import * as emailController from "./email.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";

const router = Router();

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
  emailController.sendSingleEmail,
);

router.post(
  "/send",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "ats_admin",
    "vendor_manager",
    "recruiter",
    "sourcing_specialist",
  ]),
  emailController.sendEmail,
);

export default router;
