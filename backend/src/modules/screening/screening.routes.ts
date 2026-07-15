import { Router } from "express";
import { getScreeningSession, postScreeningMessage } from "./screening.controller";

// Public, unauthenticated router — candidate-facing, token-verified inside the
// controller. Deliberately excludes authMiddleware/tenantIsolation: an anonymous
// candidate has no req.user.
const router = Router();

router.get("/sessions/:id", getScreeningSession);
router.post("/sessions/:id/messages", postScreeningMessage);

export default router;
