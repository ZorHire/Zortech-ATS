import multer from "multer";

// Firebase Functions has no persistent filesystem — always use memory storage.
// For persistent file URLs, upload to Firebase Storage separately.

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt"]);

// General memory upload (no mime filter) — used for candidate resume uploads
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// Strict memory upload with mime filter — used for parse routes
export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    if (ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, DOC, and TXT files are supported."));
    }
  },
});
