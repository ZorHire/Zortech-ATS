import dotenv from "dotenv";
import path from "path";

// Load root .env for local development; Firebase injects env vars in production
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const env = {
  PORT: process.env.SERVER_PORT || "5000",
  DATABASE_URL: process.env.SERVER_DATABASE_URL || "",
  JWT_SECRET: process.env.SERVER_JWT_SECRET || "",
  NODE_ENV: process.env.SERVER_NODE_ENV || "production",
  UPLOAD_DIR: process.env.SERVER_UPLOAD_DIR || "/tmp/uploads",
  // AES-256 key used to encrypt per-user SMTP app-passwords at rest
  EMAIL_ENCRYPTION_KEY: process.env.SERVER_EMAIL_ENCRYPTION_KEY || process.env.EMAIL_ENCRYPTION_KEY || "",
  // Gemini API key for AI-powered document parsing
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  // Frontend origin — used to construct password-reset links in transactional emails
  FRONTEND_URL: process.env.SERVER_FRONTEND_URL || process.env.FRONTEND_URL || "http://localhost:5173",
  // Razorpay payment gateway
  RAZORPAY_KEY_ID:     process.env.RAZORPAY_KEY_ID     || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",

  // ── Multi-tenant DB-per-tenant config ───────────────────────────────────────
  // Base Neon connection URL without the database name component.
  // Format: postgresql://user:pass@ep-xxx.region.aws.neon.tech
  // If not set, TenantConnectionManager derives it automatically from DATABASE_URL.
  // Set this explicitly if your tenant databases are in a different Neon project.
  NEON_BASE_URL: process.env.NEON_BASE_URL || process.env.SERVER_NEON_BASE_URL || "",

  // Redis URL for BullMQ provisioning queue (optional — required only if running
  // the async provisioning worker outside Firebase Functions).
  REDIS_URL: process.env.REDIS_URL || process.env.SERVER_REDIS_URL || "",
};

export default env;
