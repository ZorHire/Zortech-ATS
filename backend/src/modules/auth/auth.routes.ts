import { Router } from "express";
import * as authController from "./auth.controller";
import { authMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validation";

const router = Router();

// Validation schemas
const loginSchema = { required: ["email", "password"] };
const changePasswordSchema = { required: ["currentPassword", "newPassword"] };

router.post("/login", validate(loginSchema), authController.login);
router.post("/reset-password", validate({ required: ["email", "newPassword"] }), authController.resetPassword);
router.post(
  "/register",
  validate({ required: ["email", "password", "full_name"] }),
  authController.register,
);
router.post(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.get("/me", authMiddleware, authController.getMe);
router.post("/logout", authMiddleware, authController.logout);

export default router;
