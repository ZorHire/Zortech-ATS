import dotenv from "dotenv";
import path from "path";

// Load root .env for local development; Firebase injects env vars in production
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const env = {
  PORT: process.env.SERVER_PORT || "5000",
  DATABASE_URL: process.env.SERVER_DATABASE_URL || "",
  JWT_SECRET: process.env.SERVER_JWT_SECRET || "your_jwt_secret_key_here",
  NODE_ENV: process.env.SERVER_NODE_ENV || "development",
  UPLOAD_DIR: process.env.SERVER_UPLOAD_DIR || "/tmp/uploads",
  SMTP_HOST: process.env.SERVER_SMTP_HOST || "",
  SMTP_PORT: process.env.SERVER_SMTP_PORT || "587",
  SMTP_SECURE: process.env.SERVER_SMTP_SECURE || "false",
  SMTP_USER: process.env.SERVER_SMTP_USER || "",
  SMTP_PASS: process.env.SERVER_SMTP_PASS || "",
  EMAIL_FROM: process.env.SERVER_EMAIL_FROM || "no-reply@zortech-hosting.local",
  // Gmail credentials (set via Firebase secret or .env)
  EMAIL_USER: process.env.SERVER_EMAIL_USER || process.env.EMAIL_USER || "",
  EMAIL_PASS: process.env.SERVER_EMAIL_PASS || process.env.EMAIL_PASS || "",
  // AES-256 key used to encrypt per-user SMTP app-passwords at rest
  EMAIL_ENCRYPTION_KEY: process.env.SERVER_EMAIL_ENCRYPTION_KEY || process.env.EMAIL_ENCRYPTION_KEY || "",
};

export default env;
