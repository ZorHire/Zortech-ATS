import { Router } from "express";
import * as offersController from "./offers.controller";
import { authMiddleware, tenantIsolation } from "../../middleware/auth";

const router = Router();

router.get("/stats", authMiddleware, tenantIsolation, offersController.getOfferStats);
router.get("/", authMiddleware, tenantIsolation, offersController.listOffers);
router.get("/placements", authMiddleware, tenantIsolation, offersController.listPlacements);

export default router;
