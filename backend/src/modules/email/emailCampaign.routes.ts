import { Router } from "express";
import * as emailController from "./email.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";

const router = Router();

router.get("/", authMiddleware, tenantIsolation, emailController.listCampaigns);
router.post(
  "/",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "ats_admin",
    "senior_recruiter",
    "recruiter",
    "sourcing_specialist",
  ]),
  emailController.createCampaign,
);
router.post(
  "/:id/send",
  authMiddleware,
  tenantIsolation,
  authorize([
    "super_admin",
    "ats_admin",
    "senior_recruiter",
    "recruiter",
    "sourcing_specialist",
  ]),
  emailController.sendCampaign,
);

export default router;
