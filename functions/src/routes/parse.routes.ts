import { Router } from "express";
import { authMiddleware, tenantIsolation } from "../middleware/auth";
import { memoryUpload } from "../middleware/fileUpload";
import * as parseController from "../modules/parse/parse.controller";

const router = Router();

console.log("Parse routes loaded");

router.post(
  "/resume",
  memoryUpload.single("file"),
  authMiddleware,
  tenantIsolation,
  parseController.parseResume,
);

router.post(
  "/jd",
  memoryUpload.single("file"),
  authMiddleware,
  tenantIsolation,
  parseController.parseJobDescription,
);

router.post(
  "/vendor",
  memoryUpload.single("file"),
  authMiddleware,
  tenantIsolation,
  parseController.parseVendor,
);

export default router;
