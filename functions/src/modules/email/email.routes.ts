import { Router } from "express";
import * as emailController from "./email.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const recruiterRoles = ["super_admin", "ats_admin", "senior_recruiter", "recruiter", "sourcing_specialist"];

router.get("/templates", authMiddleware, tenantIsolation, emailController.listTemplates);
router.post("/send", authMiddleware, tenantIsolation, authorize(recruiterRoles), emailController.sendEmail);

export default router;
