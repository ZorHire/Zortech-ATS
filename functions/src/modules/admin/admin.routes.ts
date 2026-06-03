import { Router } from "express";
import * as adminController from "./admin.controller";
import * as analyticsController from "./analytics.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

router.get("/users", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager"]), adminController.listUsers);
router.post("/users", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager"]), adminController.createUser);
router.patch("/users/:id", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager"]), adminController.updateUser);
router.delete("/users/:id", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager"]), adminController.deleteUser);
router.post("/users/:id/reset-password", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager"]), adminController.resetPassword);

router.get("/analytics", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager"]), analyticsController.getAnalytics);
router.get("/analytics/export", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager"]), analyticsController.exportAnalytics);

export default router;
