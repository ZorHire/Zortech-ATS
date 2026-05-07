import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import morgan from "morgan";
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
import parseRoutes from "./routes/parse.routes";

const app = express();
const port = env.PORT;

const uploadsPath = path.resolve(
  env.UPLOAD_DIR || path.resolve(__dirname, "../uploads"),
);
fs.mkdirSync(uploadsPath, { recursive: true });

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  /\.run\.app$/,           // any Cloud Run frontend
  /\.web\.app$/,           // Firebase Hosting
  /\.firebaseapp\.com$/,   // Firebase Hosting alt
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
// v1Router.use("/parse", parseRoutes); // Moved up to before express.json()

app.use("/v1", v1Router);

// Health Check
app.get("/v1/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

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
});

export default app;
