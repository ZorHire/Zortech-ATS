import { Router } from "express";
import * as vendorController from "./vendors.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

router.get("/", authMiddleware, tenantIsolation, vendorController.getVendors);
router.get("/:id", authMiddleware, tenantIsolation, vendorController.getVendorById);
router.post("/", authMiddleware, tenantIsolation, authorize(["super_admin", "ats_admin"]), vendorController.createVendor);
router.patch("/:id", authMiddleware, tenantIsolation, authorize(["super_admin", "ats_admin"]), vendorController.updateVendor);
router.delete("/:id", authMiddleware, tenantIsolation, authorize(["super_admin", "ats_admin"]), vendorController.deleteVendor);

export default router;
