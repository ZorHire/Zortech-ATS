import { Router } from "express";
import { createDemoRequest } from "./demo-requests.controller";

const router = Router();

// Public: no auth. Rate limiting is applied where the router is mounted.
router.post("/", createDemoRequest);

export default router;
