import { Router } from "express";
import { authMiddleware, tenantIsolation } from "../middleware/auth";
import { memoryUpload } from "../middleware/fileUpload";
import * as parseController from "../modules/parse/parse.controller";

const router = Router();

console.log("Parse routes loaded");

router.post(
  "/resume",
  authMiddleware,
  tenantIsolation,
  memoryUpload.single("file"),
  parseController.parseResume,
);

router.post(
  "/jd",
  authMiddleware,
  tenantIsolation,
  memoryUpload.single("file"),
  parseController.parseJobDescription,
);

export default router;
