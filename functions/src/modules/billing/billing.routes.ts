import { Router } from "express";
import {
  getPlans,
  getCurrentSubscription,
  subscribe,
  cancelSubscription,
} from "./billing.controller";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";

const router = Router();

const billingAdminRoles = ["super_admin", "accounts_manager"];
const billingReadRoles = [
  "super_admin",
  "accounts_manager",
  "recruiter",
  "vendor_manager",
];

// GET /v1/billing/plans — any authenticated tenant member can view plans
router.get("/plans", authMiddleware, tenantIsolation, authorize(billingReadRoles), getPlans);

// GET /v1/billing/current — any authenticated tenant member can view current subscription
router.get("/current", authMiddleware, tenantIsolation, authorize(billingReadRoles), getCurrentSubscription);

// POST /v1/billing/subscribe — only admins can change the subscription
router.post("/subscribe", authMiddleware, tenantIsolation, authorize(billingAdminRoles), subscribe);

// POST /v1/billing/cancel — only admins can cancel
router.post("/cancel", authMiddleware, tenantIsolation, authorize(billingAdminRoles), cancelSubscription);

export default router;
