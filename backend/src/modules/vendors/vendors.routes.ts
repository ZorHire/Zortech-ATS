import { Router } from "express";
import * as vendorController from "./vendors.controller";
import * as contractsController from "./vendor-contracts.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";

const router = Router();

const MANAGE_ROLES = ["super_admin", "accounts_manager", "vendor_manager"];

// leaderboard MUST be before /:id to avoid Express treating "leaderboard" as :id
router.get("/leaderboard", authMiddleware, tenantIsolation, vendorController.getVendorLeaderboard);

router.get("/", authMiddleware, tenantIsolation, vendorController.getVendors);
router.get("/:id", authMiddleware, tenantIsolation, vendorController.getVendorById);
router.post("/", authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), vendorController.createVendor);
router.patch("/:id", authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), vendorController.updateVendor);
router.delete("/:id", authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), vendorController.deleteVendor);

router.get("/:id/scorecard", authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), vendorController.getVendorScorecard);
router.patch("/:id/submissions/:submissionId/feedback", authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), vendorController.addSubmissionFeedback);

router.get("/:id/contracts", authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), contractsController.listContracts);
router.post("/:id/contracts", authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), contractsController.createContract);
router.patch("/:id/contracts/:contractId", authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), contractsController.updateContract);
router.delete("/:id/contracts/:contractId", authMiddleware, tenantIsolation, authorize(MANAGE_ROLES), contractsController.deleteContract);

export default router;
