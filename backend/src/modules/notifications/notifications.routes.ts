import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import * as notificationController from "./notifications.controller";

const router = Router();

router.get("/", authMiddleware, notificationController.getNotifications);
router.patch("/read-all", authMiddleware, notificationController.markAllRead);
router.patch("/:id/read", authMiddleware, notificationController.markRead);

export default router;
