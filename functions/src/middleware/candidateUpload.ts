/**
 * Firebase Cloud Run–compatible multipart middleware for candidate forms.
 *
 * Why not Multer?
 *   Multer wraps busboy and assumes the incoming request is a live readable
 *   stream. Firebase Cloud Run may fully buffer the HTTP request body before
 *   the Express handler is invoked, leaving that stream in an already-ended
 *   state. Busboy then emits "Unexpected end of form" because it never sees
 *   the closing multipart boundary.
 *
 * This middleware uses busboy directly — same approach as parseFileUpload —
 * but also parses form text fields into req.body alongside the optional file
 * into req.file.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Busboy = require("busboy") as (opts: Record<string, any>) => any;
import { Readable } from "stream";
import { Request, Response, NextFunction } from "express";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

export function candidateUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const contentType = req.headers["content-type"] ?? "";

  if (!contentType.includes("multipart/form-data")) {
    // Not a multipart request — pass through unchanged
    return next();
  }

  let settled = false;
  const done = (fn: () => void) => {
    if (settled) return;
    settled = true;
    fn();
  };

  const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE } });

  const fields: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let fileName = "";
  let fileMime = "";
  let fileEncoding = "7bit";
  let fileFound = false;

  bb.on("field", (name: string, value: string) => {
    fields[name] = value;
  });

  bb.on("file", (fieldname: string, file: any, info: any) => {
    if (fieldname !== "resume") {
      file.resume(); // drain and ignore unexpected fields
      return;
    }
    fileFound = true;
    fileName = info.filename ?? "";
    fileMime = info.mimeType ?? "application/octet-stream";
    fileEncoding = info.encoding ?? "7bit";

    file.on("data", (chunk: Buffer) => chunks.push(chunk));
    file.on("limit", () => {
      done(() =>
        res.status(400).json({ message: "Resume file exceeds the 8 MB size limit." }),
      );
      file.resume();
    });
  });

  bb.on("finish", () => {
    done(() => {
      (req as any).body = fields;

      if (fileFound && chunks.length > 0) {
        const buffer = Buffer.concat(chunks);
        (req as any).file = {
          fieldname: "resume",
          originalname: fileName,
          encoding: fileEncoding,
          mimetype: fileMime,
          buffer,
          size: buffer.length,
        };
      }

      next();
    });
  });

  bb.on("error", (err: Error) => {
    console.error("[candidateUpload] Busboy error:", err.message);
    done(() =>
      res.status(400).json({ message: err.message || "File upload processing failed." }),
    );
  });

  // Firebase Functions v1 pre-buffers into req.rawBody (Buffer).
  // Firebase Functions v2 / Cloud Run delivers a live readable stream.
  // Handle both so this works in local emulators and on Cloud Run.
  const rawBody = (req as any).rawBody;

  if (rawBody instanceof Buffer) {
    const readable = new Readable();
    readable.push(rawBody);
    readable.push(null);
    readable.pipe(bb);
  } else {
    req.pipe(bb);
  }
}
