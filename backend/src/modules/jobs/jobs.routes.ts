import { Router } from "express";
import * as jobController from "./jobs.controller";
import {
  authMiddleware,
  authorize,
  tenantIsolation,
} from "../../middleware/auth";

const router = Router();

router.get("/", authMiddleware, tenantIsolation, jobController.getJobs);
router.get("/:id", authMiddleware, tenantIsolation, jobController.getJobById);
router.post(
  "/",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "ats_admin", "vendor_manager", "recruiter"]),
  jobController.createJob,
);
router.patch(
  "/:id",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "ats_admin", "vendor_manager", "recruiter"]),
  jobController.updateJob,
);
router.delete(
  "/:id",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "ats_admin", "vendor_manager", "recruiter"]),
  jobController.deleteJob,
);

export default router;
