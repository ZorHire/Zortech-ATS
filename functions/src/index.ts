import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import env from "./config/env";
import authRoutes from "./modules/auth/auth.routes";
import clientRoutes from "./modules/clients/clients.routes";
import jobRoutes from "./modules/jobs/jobs.routes";
import candidateRoutes from "./modules/candidates/candidates.routes";
import vendorRoutes from "./modules/vendors/vendors.routes";
import adminRoutes from "./modules/admin/admin.routes";
import pipelineRoutes from "./modules/pipeline/pipeline.routes";
import emailRoutes from "./modules/email/email.routes";
import emailCampaignRoutes from "./modules/email/emailCampaign.routes";
import interviewRoutes from "./modules/interviews/interviews.routes";
import parseRoutes from "./routes/parse.routes";
import jobCandidateRoutes from "./modules/jobs/jobCandidates.routes";
import billingRoutes from "./modules/billing/billing.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import tenantRoutes from "./modules/tenants/tenants.routes";
import onboardingRoutes from "./modules/onboarding/onboarding.routes";
import screeningRoutes from "./modules/screening/screening.routes";
import { requireActiveSubscription } from "./middleware/subscriptionCheck";
import { softAuth } from "./middleware/auth";
import { resolveTenant } from "./middleware/tenantResolution";
import pool from "./db";

if (!env.JWT_SECRET) {
  console.error(
    "[startup] CRITICAL: SERVER_JWT_SECRET is not set. " +
    "All authentication and token operations will fail. " +
    "Add this secret in Firebase and redeploy.",
  );
}

if (!env.EMAIL_ENCRYPTION_KEY) {
  console.error(
    "[startup] CRITICAL: SERVER_EMAIL_ENCRYPTION_KEY is not set. " +
    "All email operations requiring credential decryption will fail. " +
    "Add this secret in Firebase and redeploy.",
  );
}

const app = express();

// Trust Firebase/Cloud Run proxy so express-rate-limit reads the real client IP
app.set("trust proxy", 1);

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://zortech-solutions-51a8d.web.app",
      "https://zortech-solutions-51a8d.firebaseapp.com",
    ],
    credentials: true,
  }),
);

// Request logging
app.use(morgan("combined"));

// Rate limiters — validate.creationStack disabled because Firebase Functions loads
// modules during the first request's cold-start, which falsely triggers ERR_ERL_CREATED_IN_REQUEST_HANDLER.
// validate.xForwardedForHeader disabled because trust proxy is set above.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { creationStack: false, xForwardedForHeader: false },
  message: { message: "Too many attempts. Please try again in 15 minutes." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { creationStack: false, xForwardedForHeader: false },
  message: { message: "Too many requests. Please slow down." },
});

// A5 screening chat is the first unauthenticated, LLM-cost-exposed public endpoint —
// tighter than apiLimiter's blanket 200/min, stacks with it (doesn't replace it).
const screeningLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { creationStack: false, xForwardedForHeader: false },
  message: { message: "Too many requests. Please slow down." },
});

// Apply strict limiter only to credential-submission endpoints.
// /auth/me and /auth/logout are session endpoints called on every page load —
// applying the strict limiter there would exhaust the window for normal users
// in Cloud Run where many clients may share a proxy IP.
app.use("/v1/auth/login", authLimiter);
app.use("/v1/auth/forgot-password", authLimiter);
app.use("/v1/auth/reset-password", authLimiter);
app.use("/v1/auth/setup", authLimiter);
app.use("/v1/screening", screeningLimiter);

// Apply general limiter to all API routes
app.use("/v1", apiLimiter);

// CRITICAL: Mount multipart routes BEFORE express.json() to prevent stream consumption.
// express.json() (body-parser) exhausts the request stream in Cloud Run even for
// non-JSON content types, so any route using multer MUST be registered here.
app.use("/v1/parse", parseRoutes);
app.use("/v1/candidates", candidateRoutes);
app.use("/v1/jobs", jobCandidateRoutes);

app.use(express.json());

// Health check — verifies DB connectivity
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "degraded", db: "unreachable" });
  }
});

// Mount all routes under /v1
const v1Router = express.Router();

// softAuth parses the JWT (if present) and sets req.user without rejecting the
// request. This must run before requireActiveSubscription so the gate can read
// the tenant. Per-route authMiddleware still hard-rejects missing/invalid tokens.
v1Router.use(softAuth);
v1Router.use(resolveTenant);

v1Router.use("/auth", authRoutes);
v1Router.use("/billing", billingRoutes);       // billing exempt: tenant must be able to subscribe
v1Router.use("/tenants", tenantRoutes);         // tenant mgmt exempt: ZorTech onboarding flow
v1Router.use("/onboarding", onboardingRoutes); // onboarding exempt: accessible before subscription
v1Router.use("/screening", screeningRoutes); // screening exempt: unauthenticated candidate-facing, must never hit the subscription gate

// ─── Subscription gate ────────────────────────────────────────────────────────
// All routes below require an active or in-trial subscription.
// ZorTech (is_platform_owner) passes through automatically inside the middleware.
v1Router.use(requireActiveSubscription);

v1Router.use("/clients", clientRoutes);
v1Router.use("/jobs", jobRoutes);
v1Router.use("/vendors", vendorRoutes);
v1Router.use("/admin", adminRoutes);
v1Router.use("/pipeline", pipelineRoutes);
v1Router.use("/email", emailRoutes);
v1Router.use("/email-campaigns", emailCampaignRoutes);
v1Router.use("/interviews", interviewRoutes);
v1Router.use("/dashboard", dashboardRoutes);
// Note: /parse and /candidates are mounted globally before express.json()

app.use("/v1", v1Router);

// 404 fallback — always return JSON
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Global error:", err.message);
    res.status(400).json({ message: err.message || "An error occurred" });
  },
);

export const api = onRequest(
  { secrets: ["SERVER_DATABASE_URL", "SERVER_JWT_SECRET", "SERVER_EMAIL_ENCRYPTION_KEY", "GEMINI_API_KEY"] },
  app,
);
