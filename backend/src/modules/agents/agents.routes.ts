import { Router } from "express";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import * as agents from "./agents.controller";
import { confirmSchedulingSlot, getSchedulingInvite } from "./schedulerAgent";

const STAFF = ["super_admin", "accounts_manager", "vendor_manager", "recruiter"];
const MANAGERS = ["super_admin", "accounts_manager", "recruiter"];

/** Authenticated: /v1/agents/* */
export const agentsRouter = Router();
agentsRouter.use(authMiddleware, tenantIsolation);
agentsRouter.get("/jobs/:jobId/autopilot", authorize(STAFF), agents.getAutopilot);
agentsRouter.put("/jobs/:jobId/autopilot", authorize(MANAGERS), agents.putAutopilot);
agentsRouter.get("/activity", authorize(STAFF), agents.getActivity);
agentsRouter.get("/summary", authorize(STAFF), agents.getSummary);
agentsRouter.post("/pause-all", authorize(MANAGERS), agents.pauseAll);
agentsRouter.post("/applications/:id/run", authorize(MANAGERS), agents.runAgentNow);
agentsRouter.get("/applications/:id/insights", authorize(STAFF), agents.getInsights);

/** Public, candidate-facing: /v1/scheduling/:token (token verified in the handler). */
export const schedulingRouter = Router();
schedulingRouter.get("/:token", getSchedulingInvite);
schedulingRouter.post("/:token", confirmSchedulingSlot);
