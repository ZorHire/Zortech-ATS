import dotenv from "dotenv";
import path from "path";

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const env = {
  PORT: process.env.PORT || process.env.SERVER_PORT || "5000",
  DATABASE_URL: process.env.SERVER_DATABASE_URL || "",
  JWT_SECRET: process.env.SERVER_JWT_SECRET || "",
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
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  FRONTEND_URL:
    process.env.SERVER_FRONTEND_URL || "https://zorhire.zortechs.in",
  // A5 dark-build gate — defaults false in every environment. Must be explicitly set
  // to "true" for the screening-invite endpoint to create sessions or send emails.
  SCREENING_CHAT_ENABLED: process.env.SCREENING_CHAT_ENABLED === "true",
  // Ledger app — separate Neon database, completely isolated from the ATS DB
  LEDGER_DATABASE_URL: process.env.LEDGER_DATABASE_URL || "",
  LEDGER_API_KEY: process.env.LEDGER_API_KEY || "",
  //Google OAuth creds for login
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
  GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI || "",
  //mICROSOFT OAUTH creds for login
  MICROSOFT_OAUTH_CLIENT_ID: process.env.MICROSOFT_OAUTH_CLIENT_ID || "",
  MICROSOFT_OAUTH_CLIENT_SECRET:
    process.env.MICROSOFT_OAUTH_CLIENT_SECRET || "",
  MICROSOFT_OAUTH_REDIRECT_URI: process.env.MICROSOFT_OAUTH_REDIRECT_URI || "",
};

// Fail fast on startup if critical secrets are missing
const REQUIRED = ["DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY"] as const;
const ENV_VAR_NAMES: Record<string, string> = {
  JWT_SECRET: "SERVER_JWT_SECRET",
  ENCRYPTION_KEY: "EMAIL_ENCRYPTION_KEY",
};
for (const key of REQUIRED) {
  if (!env[key]) {
    throw new Error(
      `Missing required environment variable: ${ENV_VAR_NAMES[key] ?? key}`,
    );
  }
}

export default env;
