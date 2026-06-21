import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import * as profileController from "./profiles.controller";

const router = Router();

router.get("/", authMiddleware, profileController.getProfile);
router.put("/", authMiddleware, profileController.updateProfile);

export default router;
