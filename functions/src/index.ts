import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";

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

const app = express();

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

// CRITICAL: Mount parse routes BEFORE express.json() to prevent stream consumption
// This allows Multer to handle the multipart/form-data request first
app.use("/v1/parse", parseRoutes);

app.use(express.json());

// Debug logging
app.use((req, _res, next) => {
  console.log("Route hit:", req.method, req.url);
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Firebase Functions API is running" });
});

// Mount all routes under /v1
const v1Router = express.Router();

v1Router.use("/auth", authRoutes);
v1Router.use("/clients", clientRoutes);
v1Router.use("/jobs", jobRoutes);
v1Router.use("/candidates", candidateRoutes);
v1Router.use("/vendors", vendorRoutes);
v1Router.use("/admin", adminRoutes);
v1Router.use("/pipeline", pipelineRoutes);
v1Router.use("/email", emailRoutes);
v1Router.use("/email-campaigns", emailCampaignRoutes);
// Note: /parse is now mounted globally before express.json()

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
  { secrets: ["SERVER_DATABASE_URL", "SERVER_JWT_SECRET"] },
  app,
);
