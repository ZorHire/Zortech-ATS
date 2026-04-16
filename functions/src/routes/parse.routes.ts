import { Router } from "express";
import { authMiddleware, tenantIsolation } from "../middleware/auth";
import { parseFileUpload } from "../middleware/parseFileUpload";
import * as parseController from "../modules/parse/parse.controller";

const router = Router();

console.log("Parse routes loaded");

router.post(
  "/resume",
  authMiddleware,
  tenantIsolation,
  parseFileUpload,
  parseController.parseResume,
);

router.post(
  "/jd",
  authMiddleware,
  tenantIsolation,
  parseFileUpload,
  parseController.parseJobDescription,
);

router.post(
  "/vendor",
  authMiddleware,
  tenantIsolation,
  parseFileUpload,
  parseController.parseVendor,
);

export default router;
