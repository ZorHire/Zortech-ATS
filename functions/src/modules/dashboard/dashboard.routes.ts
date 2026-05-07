import { Router } from "express";
import { getDashboardStats } from "./dashboard.controller";
import { authMiddleware, tenantIsolation, authorize } from "../../middleware/auth";

const router = Router();

const dashboardRoles = ["super_admin", "accounts_manager", "recruiter", "vendor_manager"];

router.get("/stats", authMiddleware, tenantIsolation, authorize(dashboardRoles), getDashboardStats);

export default router;
