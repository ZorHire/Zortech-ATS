import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./modules/auth/auth.routes";
import clientRoutes from "./modules/clients/clients.routes";
import jobRoutes from "./modules/jobs/jobs.routes";
import candidateRoutes from "./modules/candidates/candidates.routes";
import vendorRoutes from "./modules/vendors/vendors.routes";
import adminRoutes from "./modules/admin/admin.routes";
import pipelineRoutes from "./modules/pipeline/pipeline.routes";
import emailRoutes from "./modules/email/email.routes";
import emailCampaignRoutes from "./modules/email/emailCampaign.routes";
import parseRoutes from "./routes/parse.routes";
import pool from "./db";

const app = express();

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

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in 15 minutes." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});

// Apply strict limiter to auth endpoints
app.use("/v1/auth", authLimiter);

// Apply general limiter to all API routes
app.use("/v1", apiLimiter);

// CRITICAL: Mount multipart routes BEFORE express.json() to prevent stream consumption.
// express.json() (body-parser) exhausts the request stream in Cloud Run even for
// non-JSON content types, so any route using multer MUST be registered here.
app.use("/v1/parse", parseRoutes);
app.use("/v1/candidates", candidateRoutes);

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

v1Router.use("/auth", authRoutes);
v1Router.use("/clients", clientRoutes);
v1Router.use("/jobs", jobRoutes);
v1Router.use("/vendors", vendorRoutes);
v1Router.use("/admin", adminRoutes);
v1Router.use("/pipeline", pipelineRoutes);
v1Router.use("/email", emailRoutes);
v1Router.use("/email-campaigns", emailCampaignRoutes);
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
