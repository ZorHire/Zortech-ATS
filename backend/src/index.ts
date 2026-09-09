import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import pool from "./db";
import { authMiddleware } from "./middleware/auth";
import env from "./config/env";
import authRoutes from "./modules/auth/auth.routes";
import clientRoutes from "./modules/clients/clients.routes";
import jobRoutes from "./modules/jobs/jobs.routes";
import candidateRoutes from "./modules/candidates/candidates.routes";
import vendorRoutes from "./modules/vendors/vendors.routes";
import adminRoutes from "./modules/admin/admin.routes";
import pipelineRoutes from "./modules/pipeline/pipeline.routes";
import emailRoutes from "./modules/email/email.routes";
import billingRoutes from "./modules/billing/billing.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import campaignRoutes from "./modules/email/campaigns.routes";
import onboardingRoutes from "./modules/onboarding/onboarding.routes";
import parseRoutes from "./routes/parse.routes";
import screeningRoutes from "./modules/screening/screening.routes";
import vendorPortalRoutes from "./modules/vendor-portal/vendor-portal.routes";
import clientPortalRoutes from "./modules/client-portal/client-portal.routes";
import jdLifecycleRoutes from "./modules/jd-lifecycle/jd-lifecycle.routes";
import interviewRoutes from "./modules/interviews/interviews.routes";
import offersRoutes from "./modules/offers/offers.routes";
import profileRoutes from "./modules/profiles/profiles.routes";
import notificationRoutes from "./modules/notifications/notifications.routes";
import jobBoardRoutes from "./modules/job-boards/job-boards.routes";
import savedSearchRoutes from "./modules/saved-searches/saved-searches.routes";
import invoicesRoutes from "./modules/invoices/invoices.routes";
import analyticsEnhancedRoutes from "./modules/analytics/analytics-enhanced.routes";
import integrationsRoutes from "./modules/integrations/integrations.routes";
import ledgerRoutes from "./modules/ledger/ledger.routes";
import { initLedgerDb } from "./modules/ledger/ledger.db";
import { startScheduler } from "./scheduler";

const app = express();
const port = env.PORT;

// Trust the reverse proxy so express-rate-limit reads the real client IP.
app.set("trust proxy", 1);

const uploadsPath = path.resolve(
  env.UPLOAD_DIR || path.resolve(__dirname, "../uploads"),
);
fs.mkdirSync(uploadsPath, { recursive: true });

// Middleware
app.use(helmet());

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://zorhire.zortechs.in",
  /\.run\.app$/, // any Cloud Run frontend
  /\.web\.app$/, // Firebase Hosting
  /\.firebaseapp\.com$/, // Firebase Hosting alt
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Null/undefined origin (server-to-server, curl) rejected when credentials=true
      // to prevent CSRF from non-browser callers that forge a null Origin.
      if (!origin) return callback(null, false);
      const allowed = allowedOrigins.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin),
      );
      callback(allowed ? null : new Error("CORS: origin not allowed"), allowed);
    },
    credentials: true,
  }),
);

// Rate limiter for auth endpoints — brute-force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
  skipSuccessfulRequests: true,
});

// Dedicated forgot-password limiter — stricter, counts every request (no skipSuccessfulRequests).
// skipSuccessfulRequests would let attackers enumerate accounts indefinitely via successful calls.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Per-IP limiter for the AI-backed parse endpoints (Gemini cost exposure)
const parseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});

// CRITICAL: Mount parse routes BEFORE express.json() to prevent stream consumption
// This allows Multer to handle the multipart/form-data request first
const parseRouter = express.Router();
parseRouter.use("/", parseRoutes);
app.use("/v1/parse", parseLimiter, parseRouter);

// A5 screening chat is the first unauthenticated, LLM-cost-exposed public endpoint
// in this backend — no rate limiting existed here at all before this.
const screeningLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});
app.use("/v1/screening", screeningLimiter);

app.use(express.json());
app.use(morgan("dev"));

// Serve uploaded files only to authenticated users
app.use("/uploads", authMiddleware as express.RequestHandler, express.static(uploadsPath));

// Test DB Connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error acquiring client", err.stack);
  }
  console.log("Connected to PostgreSQL database");
  release();
});

// Ledger DB — separate Neon database
initLedgerDb().catch((err) =>
  console.error("Ledger DB init failed:", err.message)
);

// Liveness — registered before the v1Router so it is never shadowed by route
// middleware. curl and Docker healthcheck both hit this path. Deliberately does
// NOT touch the database: a dependency outage must not make Docker churn the
// container, since restarting cannot fix an upstream database problem.
app.get("/v1/health", (_req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

// Readiness — verifies the backend can actually serve requests. Every
// authenticated route needs the database, so a failure here means the API is up
// but useless; this is the path monitoring should alert on.
app.get("/v1/health/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready", database: "ok" });
  } catch (error) {
    const message = (error as Error).message;
    console.error("Readiness check failed — database unreachable:", message);
    res.status(503).json({ status: "not_ready", database: "unavailable", reason: message });
  }
});

// Routes
const v1Router = express.Router();

// Tighter rate limit on forgot-password specifically (applies before the broader authLimiter)
v1Router.post("/auth/forgot-password", forgotPasswordLimiter);
v1Router.use("/auth", authLimiter, authRoutes);
v1Router.use("/clients", clientRoutes);
v1Router.use("/jobs", jobRoutes);
v1Router.use("/candidates", candidateRoutes);
v1Router.use("/vendors", vendorRoutes);
v1Router.use("/admin", adminRoutes);
v1Router.use("/pipeline", pipelineRoutes);
v1Router.use("/email", emailRoutes);
v1Router.use("/billing", billingRoutes);
v1Router.use("/dashboard", dashboardRoutes);
v1Router.use("/email-campaigns", campaignRoutes);
v1Router.use("/onboarding", onboardingRoutes);
v1Router.use("/screening", screeningRoutes);
v1Router.use("/vendor-portal", vendorPortalRoutes);
v1Router.use("/client-portal", clientPortalRoutes);
v1Router.use("/jd-lifecycle", jdLifecycleRoutes);
v1Router.use("/interviews", interviewRoutes);
v1Router.use("/offers", offersRoutes);
v1Router.use("/profile", profileRoutes);
v1Router.use("/notifications", notificationRoutes);
v1Router.use("/job-boards", jobBoardRoutes);
v1Router.use("/saved-searches", savedSearchRoutes);
v1Router.use("/invoices", invoicesRoutes);
v1Router.use("/analytics-enhanced", analyticsEnhancedRoutes);
v1Router.use("/integrations", integrationsRoutes);
v1Router.use("/ledger/kv", ledgerRoutes);
// v1Router.use("/parse", parseRoutes); // Moved up to before express.json()

app.use("/v1", v1Router);

// Global error handler — converts thrown/middleware errors to JSON (e.g. multer rejections)
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

// 404 fallback — always return JSON so the frontend can parse error messages
app.use((req: express.Request, res: express.Response) => {
  res
    .status(404)
    .json({ message: `Route ${req.method} ${req.path} not found` });
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  startScheduler();
});

export default app;
