import { Router } from "express";
import { authMiddleware, tenantIsolation } from "../middleware/auth";
import { memoryUpload } from "../middleware/fileUpload";
import * as parseController from "../modules/parse/parse.controller";

const router = Router();

console.log("Parse routes loaded");

// authMiddleware MUST come before memoryUpload — otherwise unauthenticated
// requests buffer up to 8 MB into server RAM before being rejected.
router.post(
  "/resume",
  authMiddleware,
  tenantIsolation,
  memoryUpload.single("file"),
  parseController.parseResume,
);

router.post(
  "/vendor",
  authMiddleware,
  tenantIsolation,
  memoryUpload.single("file"),
  parseController.parseVendor,
);

router.post(
  "/jd",
  authMiddleware,
  tenantIsolation,
  memoryUpload.single("file"),
  parseController.parseJobDescription,
);

export default router;
