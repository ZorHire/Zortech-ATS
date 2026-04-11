import { Router } from "express";
import multer from "multer";
import { authMiddleware, tenantIsolation } from "../../middleware/auth";
import * as parseController from "./parse.controller";

const router = Router();

// Use memory storage — we only need the buffer to parse, no disk writes needed
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, DOC and TXT files are allowed"));
    }
  },
});

router.post(
  "/resume",
  authMiddleware,
  tenantIsolation,
  memUpload.single("file"),
  parseController.parseResume,
);

router.post(
  "/jd",
  authMiddleware,
  tenantIsolation,
  memUpload.single("file"),
  parseController.parseJobDescription,
);

export default router;
