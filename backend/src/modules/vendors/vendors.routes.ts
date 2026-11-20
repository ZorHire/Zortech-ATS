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
import fs from "fs";
import type { NextFunction, Request, Response } from "express";

// Vendor documents (NDA, service agreement, insurance): stored under UPLOAD_DIR so the
// files sit next to every other upload, keep their extension, and are limited to
// document/image types. Downloads go through GET /:vendorId/documents/:docId/file.
fs.mkdirSync(vendorDocs.VENDOR_DOCS_DIR, { recursive: true });
const VENDOR_DOC_EXTENSIONS = new Set(["pdf", "doc", "docx", "png", "jpg", "jpeg"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: vendorDocs.VENDOR_DOCS_DIR,
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    if (VENDOR_DOC_EXTENSIONS.has(ext)) cb(null, true);
    else cb(new Error("Only PDF, Word (DOC/DOCX) and image (PNG/JPG) files are supported."));
  },
});

/** Runs the multer upload and turns its errors (size, type) into a 400 the UI can show. */
const uploadVendorDocFile = (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    const message =
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. The limit is 10 MB."
        : err instanceof Error
          ? err.message
          : "Upload failed";
    res.status(400).json({ message });
  });
};

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
router.post("/:vendorId/documents", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","vendor_manager"]), uploadVendorDocFile, vendorDocs.uploadVendorDoc);
router.get("/:vendorId/documents/:docId/file", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","vendor_manager"]), vendorDocs.downloadVendorDoc);
router.delete("/:vendorId/documents/:docId", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), vendorDocs.deleteVendorDoc);
router.patch("/:vendorId/documents/:docId/status", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), vendorDocs.updateVendorDocStatus);

export default router;
