import { Router } from "express";
import { authMiddleware, authorize, tenantIsolation } from "../../middleware/auth";
import * as calCtrl from "./calendar.controller";
import * as smsCtrl from "./sms.controller";
import * as webhooksCtrl from "./webhooks.controller";
import * as jobBoardsCtrl from "./job-boards-external.controller";
import * as resumeDbCtrl from "./resume-db.controller";
import * as schedulingCtrl from "./scheduling-links.controller";

const router = Router();

// ─── Calendar ────────────────────────────────────────────────────────────────
router.get("/auth/google/calendar", authMiddleware, tenantIsolation, calCtrl.googleAuthRedirect);
router.get("/auth/google/callback", calCtrl.googleAuthCallback);
router.get("/auth/outlook/calendar", authMiddleware, tenantIsolation, calCtrl.outlookAuthRedirect);
router.get("/auth/outlook/callback", calCtrl.outlookAuthCallback);
router.get("/calendar/status", authMiddleware, tenantIsolation, calCtrl.getCalendarStatus);
router.delete("/calendar/:provider", authMiddleware, tenantIsolation, calCtrl.disconnectCalendar);
router.post("/calendar/interviews/:interviewId/event", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), calCtrl.createInterviewCalendarEvent);

// ─── SMS / WhatsApp ──────────────────────────────────────────────────────────
router.post("/sms/send", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), smsCtrl.sendSMSNotification);
router.post("/sms/interview-reminder", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), smsCtrl.sendInterviewReminder);
router.post("/sms/offer-notification", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), smsCtrl.sendOfferNotification);
router.get("/sms/logs", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), smsCtrl.getSMSLogs);

// ─── Webhooks (no auth — called by external services) ───────────────────────
router.post("/webhooks/sendgrid", webhooksCtrl.sendgridWebhook);
router.post("/webhooks/calendly", webhooksCtrl.calendlyWebhook);

// ─── LinkedIn job board ──────────────────────────────────────────────────────
router.get("/auth/linkedin", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), jobBoardsCtrl.linkedinAuthRedirect);
router.get("/auth/linkedin/callback", jobBoardsCtrl.linkedinAuthCallback);
router.post("/job-boards/linkedin/jobs/:jobId", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), jobBoardsCtrl.postJobToLinkedIn);
router.delete("/job-boards/linkedin/jobs/:jobId", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager"]), jobBoardsCtrl.removeLinkedInJob);
router.post("/job-boards/naukri/jobs/:jobId", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), jobBoardsCtrl.postJobToNaukri);
router.get("/job-boards/jobs/:jobId/postings", authMiddleware, tenantIsolation, jobBoardsCtrl.getJobBoardPostings);

// ─── External resume database ────────────────────────────────────────────────
router.get("/resume-db/search", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), resumeDbCtrl.searchExternalResumes);
router.get("/resume-db/:candidateId", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), resumeDbCtrl.getExternalResumeDetails);
router.post("/resume-db/import", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), resumeDbCtrl.importExternalCandidate);

// ─── Calendly self-scheduling ────────────────────────────────────────────────
router.get("/scheduling/status", authMiddleware, tenantIsolation, schedulingCtrl.getCalendlyStatus);
router.get("/scheduling/event-types", authMiddleware, tenantIsolation, schedulingCtrl.listEventTypes);
router.post("/scheduling/links", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), schedulingCtrl.createSchedulingLink);
router.get("/scheduling/links", authMiddleware, tenantIsolation, schedulingCtrl.listSchedulingLinks);
router.post("/scheduling/links/:linkId/send", authMiddleware, tenantIsolation, authorize(["super_admin","accounts_manager","recruiter"]), schedulingCtrl.sendSchedulingLinkToCandidate);

export default router;
