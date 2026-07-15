import { Router } from "express";
import { authMiddleware, tenantIsolation } from "../../middleware/auth";
import * as savedSearchController from "./saved-searches.controller";

const router = Router();

router.get("/", authMiddleware, tenantIsolation, savedSearchController.listSavedSearches);
router.post("/", authMiddleware, tenantIsolation, savedSearchController.createSavedSearch);
router.delete("/:id", authMiddleware, tenantIsolation, savedSearchController.deleteSavedSearch);

export default router;
