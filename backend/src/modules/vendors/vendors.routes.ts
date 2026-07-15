import { Router } from "express";
import * as vendorController from "./vendors.controller";
import * as contractsController from "./vendor-contracts.controller";
import * as vendorDocs from "./vendor-docs.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
const uploadDir = path.join(__dirname, "../../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 10 * 1024 * 1024 } });

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

// Blacklist management (super_admin / accounts_manager only)
router.patch("/:id/blacklist", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager"]), vendorController.setVendorBlacklist);

// Document management
router.get("/:vendorId/documents", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","vendor_manager"]), vendorDocs.listVendorDocs);
router.post("/:vendorId/documents", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","vendor_manager"]), upload.single("file"), vendorDocs.uploadVendorDoc);
router.delete("/:vendorId/documents/:docId", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), vendorDocs.deleteVendorDoc);
router.patch("/:vendorId/documents/:docId/status", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), vendorDocs.updateVendorDocStatus);

export default router;
