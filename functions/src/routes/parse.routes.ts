import { Router } from "express";
import { authMiddleware, tenantIsolation } from "../middleware/auth";
import { requireActiveSubscription } from "../middleware/subscriptionCheck";
import { parseFileUpload } from "../middleware/parseFileUpload";
import * as parseController from "../modules/parse/parse.controller";

const router = Router();

console.log("Parse routes loaded");

router.post(
  "/resume",
  authMiddleware,
  tenantIsolation,
  requireActiveSubscription,
  parseFileUpload,
  parseController.parseResume,
);

router.post(
  "/jd",
  authMiddleware,
  tenantIsolation,
  requireActiveSubscription,
  parseFileUpload,
  parseController.parseJobDescription,
);

router.post(
  "/vendor",
  authMiddleware,
  tenantIsolation,
  requireActiveSubscription,
  parseFileUpload,
  parseController.parseVendor,
);

export default router;
