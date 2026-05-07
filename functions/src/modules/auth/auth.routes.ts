import { Router } from "express";
import * as authController from "./auth.controller";
import { authMiddleware } from "../../middleware/auth";
import { validate } from "../../middleware/validation";

const router = Router();

const loginSchema = { required: ["email", "password"] };
const changePasswordSchema = { required: ["currentPassword", "newPassword"] };

// One-time bootstrap: create first super_admin when none exists (protected by SETUP_TOKEN env var)
router.post("/setup", validate({ required: ["email", "password", "full_name", "setupToken"] }), authController.setupAdmin);

router.post("/login", validate(loginSchema), authController.login);
router.post("/reset-password", validate({ required: ["email", "newPassword"] }), authController.resetPassword);
// Self-registration is disabled — companies are onboarded by ZorTech via POST /v1/tenants/onboard
router.post(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.get("/me", authMiddleware, authController.getMe);

export default router;
