import fs from "fs";
import path from "path";
import multer from "multer";
import env from "../config/env";

const uploadRoot = path.resolve(
  env.UPLOAD_DIR || path.resolve(__dirname, "../uploads"),
);
const resumeDir = path.resolve(uploadRoot, "resumes");

fs.mkdirSync(resumeDir, { recursive: true });

const storage = multer.diskStorage({
  destination: resumeDir,
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${timestamp}-${safeName}`);
  },
});

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream", // browser fallback — some browsers send this for any binary
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt"]);

const mimeFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
  // Both MIME type AND extension must be allowed — OR logic lets attackers bypass
  // one check with a crafted filename (e.g. evil.php sent as application/pdf).
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, DOCX, DOC, and TXT files are supported."));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: mimeFilter,
});

export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: mimeFilter,
});
