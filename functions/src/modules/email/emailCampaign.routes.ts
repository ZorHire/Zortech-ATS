import { Router } from "express";
import * as emailController from "./email.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const recruiterRoles = ["super_admin", "accounts_manager", "recruiter"];

router.get("/", authMiddleware, tenantIsolation, emailController.listCampaigns);
router.post("/", authMiddleware, tenantIsolation, authorize(recruiterRoles), emailController.createCampaign);
router.post("/:id/send", authMiddleware, tenantIsolation, authorize(recruiterRoles), emailController.sendCampaign);

export default router;
