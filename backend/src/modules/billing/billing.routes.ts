import { Router } from "express";
import {
  getPlans,
  getCurrentSubscription,
  getTransactions,
  subscribe,
  verifyPayment,
  cancelSubscription,
  refundPayment,
  razorpayWebhook,
} from "./billing.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const billingAdminRoles = ["super_admin", "accounts_manager"];
const billingReadRoles = ["super_admin", "accounts_manager", "recruiter", "vendor_manager"];

// Any authenticated tenant member can view plans and current subscription
router.get("/plans",        authMiddleware, tenantIsolation, authorize(billingReadRoles), getPlans);
router.get("/current",      authMiddleware, tenantIsolation, authorize(billingReadRoles), getCurrentSubscription);
router.get("/transactions",  authMiddleware, tenantIsolation, authorize(billingReadRoles), getTransactions);

// Only admins can initiate / verify / cancel payments
router.post("/subscribe",       authMiddleware, tenantIsolation, authorize(billingAdminRoles), subscribe);
router.post("/verify-payment",  authMiddleware, tenantIsolation, authorize(billingAdminRoles), verifyPayment);
router.post("/cancel",          authMiddleware, tenantIsolation, authorize(billingAdminRoles), cancelSubscription);

// Refund — admin only
router.post("/refund", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager"]), refundPayment);

// Razorpay webhook — no auth (called by Razorpay's servers)
router.post("/razorpay-webhook", razorpayWebhook);

export default router;
