import { Router } from "express";
import * as offersController from "./offers.controller";
import { authMiddleware, tenantIsolation, authorize } from "../../middleware/auth";

const router = Router();

router.get("/stats", authMiddleware, tenantIsolation, offersController.getOfferStats);
router.get("/", authMiddleware, tenantIsolation, offersController.listOffers);
router.get("/placements", authMiddleware, tenantIsolation, offersController.listPlacements);

router.patch("/:id/stage", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager", "recruiter"]), offersController.updateOfferStage);

export default router;
