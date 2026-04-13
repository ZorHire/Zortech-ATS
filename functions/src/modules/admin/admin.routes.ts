import { Router } from "express";
import * as adminController from "./admin.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

router.get("/users", authMiddleware, tenantIsolation, authorize(["super_admin", "ats_admin"]), adminController.listUsers);
router.post("/users", authMiddleware, tenantIsolation, authorize(["super_admin", "ats_admin"]), adminController.createUser);
router.patch("/users/:id", authMiddleware, tenantIsolation, authorize(["super_admin", "ats_admin"]), adminController.updateUser);
router.post("/users/:id/reset-password", authMiddleware, tenantIsolation, authorize(["super_admin", "ats_admin"]), adminController.resetPassword);

export default router;
