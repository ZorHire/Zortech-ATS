"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryUpload = exports.upload = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const env_1 = __importDefault(require("../config/env"));
const uploadRoot = path_1.default.resolve(env_1.default.UPLOAD_DIR || path_1.default.resolve(__dirname, "../uploads"));
const resumeDir = path_1.default.resolve(uploadRoot, "resumes");
fs_1.default.mkdirSync(resumeDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: resumeDir,
    filename: (_req, file, cb) => {
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${timestamp}-${safeName}`);
    },
});
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
});
const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
]);
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt"]);
exports.memoryUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
        if (ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only PDF, DOCX, DOC, and TXT files are supported."));
        }
    },
});
