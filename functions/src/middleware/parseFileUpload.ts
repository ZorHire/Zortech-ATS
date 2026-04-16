/**
 * Firebase Cloud Run–compatible file upload middleware for parse routes.
 *
 * Why not Multer?
 *   Multer wraps busboy and assumes the incoming request is a live readable
 *   stream. Firebase Cloud Run may fully buffer the HTTP request body before
 *   the Express handler is invoked, leaving that stream in an already-ended
 *   state. Busboy then emits "Unexpected end of form" because it never sees
 *   the closing multipart boundary.
 *
 * This middleware uses busboy directly and handles both cases:
 *   1. Pre-buffered body — available on req.rawBody (Firebase Functions v1)
 *      or as a Buffer already set on req.body.
 *   2. Live stream — the normal path; req is piped straight into busboy.
 *
 * On success, req.file is populated in the same shape Multer uses so no
 * controller code needs to change.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Busboy = require("busboy") as (opts: Record<string, any>) => any;
import { Readable } from "stream";
import { Request, Response, NextFunction } from "express";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt"]);

export function parseFileUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const contentType = req.headers["content-type"] ?? "";

  if (!contentType.includes("multipart/form-data")) {
    res.status(400).json({ message: "A multipart file upload is required." });
    return;
  }

  let settled = false;
  const done = (fn: () => void) => {
    if (settled) return;
    settled = true;
    fn();
  };

  const bb = Busboy({
    headers: req.headers,
    limits: { fileSize: MAX_FILE_SIZE },
  });

  const chunks: Buffer[] = [];
  let fileName = "";
  let fileMime = "";
  let fileFound = false;

  bb.on("file", (_field: string, file: any, info: any) => {
    fileFound = true;
    fileName = info.filename;
    fileMime = info.mimeType;

    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_MIME_TYPES.has(fileMime) && !ALLOWED_EXTENSIONS.has(ext)) {
      done(() =>
        res.status(400).json({
          message: "Only PDF, DOCX, DOC, and TXT files are supported.",
        }),
      );
      // Drain the file stream so busboy can finish cleanly
      file.resume();
      return;
    }

    file.on("data", (chunk: Buffer) => chunks.push(chunk));
    file.on("limit", () => {
      done(() =>
        res.status(400).json({ message: "File exceeds the 8 MB size limit." }),
      );
      file.resume();
    });
  });

  bb.on("finish", () => {
    done(() => {
      if (!fileFound || chunks.length === 0) {
        res.status(400).json({ message: "No file found in the request." });
        return;
      }
      const buffer = Buffer.concat(chunks);
      (req as any).file = {
        fieldname: "file",
        originalname: fileName,
        encoding: "7bit",
        mimetype: fileMime,
        buffer,
        size: buffer.length,
      };
      next();
    });
  });

  bb.on("error", (err: Error) => {
    done(() =>
      res
        .status(400)
        .json({ message: err.message || "File upload processing failed." }),
    );
  });

  // ── Stream source ───────────────────────────────────────────────────────────
  // Firebase Functions v1 attaches the raw body buffer to req.rawBody.
  // Firebase Functions v2 / Cloud Run passes a live Node.js readable stream.
  // Handle both so this works locally, in Firebase emulators, and on Cloud Run.
  const rawBody = (req as any).rawBody;

  if (rawBody instanceof Buffer) {
    // Pre-buffered — wrap in a Readable so busboy can consume it
    const readable = new Readable();
    readable.push(rawBody);
    readable.push(null);
    readable.pipe(bb);
  } else {
    req.pipe(bb);
  }
}
