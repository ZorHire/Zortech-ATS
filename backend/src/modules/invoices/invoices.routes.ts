import { Router } from "express";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import * as invoicesController from "./invoices.controller";

const router = Router();

router.post(
  "/",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager"]),
  invoicesController.createInvoice,
);
router.get(
  "/",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager"]),
  invoicesController.listInvoices,
);
router.get(
  "/:id",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager"]),
  invoicesController.getInvoiceById,
);
router.patch(
  "/:id",
  authMiddleware,
  tenantIsolation,
  authorize(["super_admin", "accounts_manager"]),
  invoicesController.updateInvoice,
);

export default router;
