import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import pool from "./db";
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
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://zorhire.zortechs.in",
  "http://zorhire.zortechs.in",
  /\.run\.app$/, // any Cloud Run frontend
  /\.web\.app$/, // Firebase Hosting
  /\.firebaseapp\.com$/, // Firebase Hosting alt
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, server-to-server)
      if (!origin) return callback(null, true);
      const allowed = allowedOrigins.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin),
      );
      callback(allowed ? null : new Error("CORS: origin not allowed"), allowed);
    },
    credentials: true,
  }),
);
// CRITICAL: Mount parse routes BEFORE express.json() to prevent stream consumption
// This allows Multer to handle the multipart/form-data request first
const parseRouter = express.Router();
parseRouter.use("/", parseRoutes);
app.use("/v1/parse", parseRouter);

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
app.use(express.static(uploadsPath));
app.use(morgan("dev"));

// Test DB Connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error acquiring client", err.stack);
  }
  console.log("Connected to PostgreSQL database");
  release();
});

// Health check — registered before the v1Router so it is never shadowed by
// route middleware. curl and Docker healthcheck both hit this path.
app.get("/v1/health", (_req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

// Routes
const v1Router = express.Router();

v1Router.use("/auth", authRoutes);
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
