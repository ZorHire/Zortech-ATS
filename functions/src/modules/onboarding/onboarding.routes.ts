import { Router } from "express";
import { authMiddleware, tenantIsolation } from "../../middleware/auth";
import { getStatus, updateStatus, getAccountInfo } from "./onboarding.controller";

const router = Router();

// All onboarding endpoints require a valid JWT but NOT an active subscription.
// New tenants must be able to reach their checklist before purchasing a plan.
router.use(authMiddleware, tenantIsolation);

router.get("/status", getStatus);
router.patch("/status", updateStatus);
router.get("/account-info", getAccountInfo);

export default router;
