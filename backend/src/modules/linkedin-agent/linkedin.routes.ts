import { Router } from "express";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import * as li from "./linkedin.controller";
import * as ext from "./linkedinExt.controller";
import * as posts from "./jobPosts.controller";
import * as capture from "./capture.controller";
import { upload } from "../../middleware/fileUpload";
import { extAuth } from "./linkedinStore";

const STAFF = ["super_admin", "accounts_manager", "vendor_manager", "recruiter"];

/** Recruiter-facing: /v1/linkedin-agent/* */
export const linkedinAgentRouter = Router();
linkedinAgentRouter.use(authMiddleware, tenantIsolation, authorize(STAFF));
linkedinAgentRouter.get("/account", li.getAccountStatus);
linkedinAgentRouter.put("/account", li.updateAccount);
linkedinAgentRouter.post("/connect", li.createConnectionCode);
linkedinAgentRouter.delete("/connections/:id", li.revokeConnection);
linkedinAgentRouter.get("/summary", li.getSummary);
linkedinAgentRouter.get("/campaigns", li.listCampaigns);
linkedinAgentRouter.post("/campaigns", li.createCampaign);
linkedinAgentRouter.get("/campaigns/:id", li.getCampaign);
linkedinAgentRouter.put("/campaigns/:id", li.updateCampaign);
linkedinAgentRouter.delete("/campaigns/:id", li.deleteCampaign);
linkedinAgentRouter.post("/campaigns/:id/status", li.setCampaignStatus);
linkedinAgentRouter.post("/campaigns/:id/generate-search", li.generateSearch);
linkedinAgentRouter.post("/campaigns/:id/run-search", li.requestSearch);
linkedinAgentRouter.get("/campaigns/:id/prospects", li.listProspects);
linkedinAgentRouter.post("/campaigns/:id/prospects/bulk", li.bulkProspects);
linkedinAgentRouter.patch("/prospects/:id", li.updateProspect);
linkedinAgentRouter.post("/prospects/:id/regenerate-note", li.regenerateProspectNote);
linkedinAgentRouter.post("/prospects/:id/to-candidate", li.prospectToCandidate);

/** Free job boards (assisted posting): /v1/free-job-boards/* */
export const freeJobBoardsRouter = Router();
freeJobBoardsRouter.use(authMiddleware, tenantIsolation, authorize(STAFF));
freeJobBoardsRouter.get("/", posts.listFreeBoards);
freeJobBoardsRouter.get("/jobs/:jobId", posts.getFreePosts);
freeJobBoardsRouter.post("/jobs/:jobId", posts.requestFreePosts);
freeJobBoardsRouter.patch("/posts/:id", posts.updateFreePost);

/** Chrome extension (connection-token auth): /v1/extension/* */
export const extensionRouter = Router();
extensionRouter.use(extAuth);
extensionRouter.post("/hello", ext.hello);
extensionRouter.get("/work", ext.getWork);
extensionRouter.post("/campaigns/:id/resolved", ext.saveResolved);
extensionRouter.post("/campaigns/:id/prospects", ext.importProspects);
extensionRouter.post("/next-invite", ext.nextInvite);
extensionRouter.post("/prospects/:id/result", ext.inviteResult);
extensionRouter.post("/warning", ext.reportWarning);
extensionRouter.post("/acceptances", ext.reportAcceptances);
extensionRouter.get("/pending-sent", ext.pendingSent);
extensionRouter.get("/job-posts", posts.extPendingPosts);
extensionRouter.post("/job-posts/:id", posts.extUpdatePost);
// "Save to ZorHire" from Naukri, LinkedIn or any profile page.
extensionRouter.get("/jobs", capture.extJobs);
extensionRouter.post("/capture/preview", capture.capturePreview);
extensionRouter.post("/capture/save", capture.captureSave);
extensionRouter.post("/candidates/:id/resume", upload.single("resume"), capture.captureResume);
