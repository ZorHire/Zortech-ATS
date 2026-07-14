import dotenv from "dotenv";
import path from "path";

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const env = {
  PORT: process.env.PORT || process.env.SERVER_PORT || "5000",
  DATABASE_URL: process.env.SERVER_DATABASE_URL || "",
  JWT_SECRET: process.env.SERVER_JWT_SECRET || "fallback_secret",
  NODE_ENV: process.env.SERVER_NODE_ENV || "production",
  UPLOAD_DIR:
    process.env.SERVER_UPLOAD_DIR || path.resolve(__dirname, "../uploads"),
  // AES-256-GCM key for encrypting per-user SMTP passwords at rest.
  // Set EMAIL_ENCRYPTION_KEY in .env (64-char hex / 32 bytes).
  ENCRYPTION_KEY: process.env.EMAIL_ENCRYPTION_KEY || "",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
  FRONTEND_URL: process.env.SERVER_FRONTEND_URL || "https://zorhire.zortechs.in",
  // A5 dark-build gate — defaults false in every environment. Must be explicitly set
  // to "true" for the screening-invite endpoint to create sessions or send emails.
  SCREENING_CHAT_ENABLED: process.env.SCREENING_CHAT_ENABLED === "true",
};

export default env;
