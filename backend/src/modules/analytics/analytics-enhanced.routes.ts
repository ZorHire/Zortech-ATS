import { Router } from "express";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import * as analyticsEnhanced from "./analytics-enhanced.controller";

const router = Router();

router.get(
  "/time-to-fill",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager", "recruiter"]),
  analyticsEnhanced.getTimeToFill
);

router.get(
  "/source-effectiveness",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager"]),
  analyticsEnhanced.getSourceEffectiveness
);

router.get(
  "/recruiter-productivity",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager"]),
  analyticsEnhanced.getRecruiterProductivity
);

export default router;
