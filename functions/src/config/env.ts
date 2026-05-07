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
  // AES-256 key used to encrypt per-user SMTP app-passwords at rest
  EMAIL_ENCRYPTION_KEY: process.env.SERVER_EMAIL_ENCRYPTION_KEY || process.env.EMAIL_ENCRYPTION_KEY || "",
  // Gemini API key for AI-powered document parsing
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
};

export default env;
