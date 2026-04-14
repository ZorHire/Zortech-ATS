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
    NODE_ENV: process.env.SERVER_NODE_ENV || "development",
    TIKA_URL: process.env.TIKA_URL || "http://localhost:9998/tika",
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    UPLOAD_DIR: process.env.SERVER_UPLOAD_DIR || path_1.default.resolve(__dirname, "../uploads"),
    SMTP_HOST: process.env.SERVER_SMTP_HOST || "",
    SMTP_PORT: process.env.SERVER_SMTP_PORT || "587",
    SMTP_SECURE: process.env.SERVER_SMTP_SECURE || "false",
    SMTP_USER: process.env.SERVER_SMTP_USER || "",
    SMTP_PASS: process.env.SERVER_SMTP_PASS || "",
    EMAIL_FROM: process.env.SERVER_EMAIL_FROM || "no-reply@zortech-hosting.local",
};
exports.default = exports.env;
