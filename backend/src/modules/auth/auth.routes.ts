import { Router } from "express";

import * as authController from "./auth.controller";

import { authMiddleware } from "../../middleware/auth";

import { validate } from "../../middleware/validation";

const router = Router();

const oauthController = authController as typeof authController & {
  googleStart?: (req: any, res: any, next?: any) => any;
  googleCallback?: (req: any, res: any, next?: any) => any;
  microsoftStart?: (req: any, res: any, next?: any) => any;
  microsoftCallback?: (req: any, res: any, next?: any) => any;
  exchangeOAuthCode?: (req: any, res: any, next?: any) => any;
};

const oauthNotConfigured = (req: any, res: any) => {
  res.status(501).json({
    message: "OAuth is not configured for this environment yet.",
  });
};

// -----------------------------------------------------------------------------
// Validation schemas
// -----------------------------------------------------------------------------

const loginSchema = {
  required: ["email", "password"],
};

const changePasswordSchema = {
  required: ["currentPassword", "newPassword"],
};

// -----------------------------------------------------------------------------
// Email / Password authentication
// -----------------------------------------------------------------------------

router.post("/login", validate(loginSchema), authController.login);

router.post(
  "/forgot-password",
  validate({ required: ["email"] }),
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  validate({ required: ["token", "newPassword"] }),
  authController.resetPassword,
);

router.post(
  "/register",
  validate({
    required: ["email", "password", "full_name"],
  }),
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

// -----------------------------------------------------------------------------
// OAuth authentication
// -----------------------------------------------------------------------------
//
// Google
//   GET /v1/auth/oauth/google
//   GET /v1/auth/oauth/google/callback
//
// Microsoft
//   GET /v1/auth/oauth/microsoft
//   GET /v1/auth/oauth/microsoft/callback
//
// Frontend exchanges the short-lived OAuth code for the normal ATS JWT:
//   POST /v1/auth/oauth/exchange
//
// IMPORTANT:
// OAuth does NOT create a new tenant or bypass the subscription wall.
// It authenticates an existing ZorHire user.
// -----------------------------------------------------------------------------

router.get(
  "/oauth/google",
  oauthController.googleStart ?? oauthNotConfigured,
);

router.get(
  "/oauth/google/callback",
  oauthController.googleCallback ?? oauthNotConfigured,
);

router.get(
  "/oauth/microsoft",
  oauthController.microsoftStart ?? oauthNotConfigured,
);

router.get(
  "/oauth/microsoft/callback",
  oauthController.microsoftCallback ?? oauthNotConfigured,
);

router.post(
  "/oauth/exchange",
  oauthController.exchangeOAuthCode ?? oauthNotConfigured,
);

export default router;
