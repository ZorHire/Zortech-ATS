"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load root .env file
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../../../.env") });
exports.env = {
    PORT: process.env.PORT || process.env.SERVER_PORT || "5000",
    DATABASE_URL: process.env.SERVER_DATABASE_URL || "",
    JWT_SECRET: process.env.SERVER_JWT_SECRET || "fallback_secret",
    NODE_ENV: process.env.SERVER_NODE_ENV || "production",
    UPLOAD_DIR: process.env.SERVER_UPLOAD_DIR || path_1.default.resolve(__dirname, "../uploads"),
    // AES-256-GCM key for encrypting per-user SMTP passwords at rest.
    // Set EMAIL_ENCRYPTION_KEY in .env (64-char hex / 32 bytes).
    ENCRYPTION_KEY: process.env.EMAIL_ENCRYPTION_KEY || "",
};
exports.default = exports.env;
