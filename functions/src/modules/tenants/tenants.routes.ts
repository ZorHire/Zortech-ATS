import { Router } from "express";
import { authMiddleware, tenantIsolation } from "../../middleware/auth";
import {
  onboardCompany,
  listTenants,
  getTenant,
  setTenantStatus,
} from "./tenants.controller";

const router = Router();

router.use(authMiddleware, tenantIsolation);

router.post("/onboard", onboardCompany);
router.get("/", listTenants);
router.get("/:id", getTenant);
router.patch("/:id/status", setTenantStatus);

export default router;
