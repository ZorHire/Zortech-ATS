import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import env from "../config/env";

// Resume file storage.
//
// When R2 is configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET) resumes go to a PRIVATE Cloudflare R2 bucket and candidates.resume_url
// stores "r2:<object key>". Files are never publicly reachable: the API streams
// them to authenticated users via GET /v1/candidates/:id/resume.
//
// When R2 is not configured, behaviour is unchanged: files are written to
// UPLOAD_DIR/resumes and resume_url stores "/uploads/resumes/<name>".

export const R2_PREFIX = "r2:";

const uploadRoot = path.resolve(
  env.UPLOAD_DIR || path.resolve(__dirname, "../uploads"),
);
const resumeDir = path.resolve(uploadRoot, "resumes");

let client: S3Client | null = null;

export function isR2Enabled(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
  );
}

function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function safeName(original: string): string {
  const cleaned = original.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return cleaned || "resume";
}

/** Object key layout: resumes/<tenantId>/<yyyy>/<mm>/<random>-<filename> */
export function buildResumeKey(tenantId: string, originalName: string, when = new Date()): string {
  const yyyy = when.getUTCFullYear();
  const mm = String(when.getUTCMonth() + 1).padStart(2, "0");
  const rand = crypto.randomBytes(8).toString("hex");
  return `resumes/${tenantId}/${yyyy}/${mm}/${rand}-${safeName(originalName)}`;
}

export async function putResumeObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    }),
  );
}

/**
 * Persist an uploaded resume (multer memory file) and return the value to store
 * in candidates.resume_url.
 */
export async function saveResume(
  tenantId: string,
  file: Express.Multer.File,
): Promise<string> {
  if (!file.buffer) throw new Error("Resume upload has no file contents");

  if (isR2Enabled()) {
    const key = buildResumeKey(tenantId, file.originalname);
    await putResumeObject(key, file.buffer, file.mimetype);
    return `${R2_PREFIX}${key}`;
  }

  fs.mkdirSync(resumeDir, { recursive: true });
  const name = `${Date.now()}-${safeName(file.originalname)}`;
  await fs.promises.writeFile(path.join(resumeDir, name), file.buffer);
  return `/uploads/resumes/${name}`;
}

export interface StoredResume {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
}

/** Fetch a resume stored in R2. Returns null when the object does not exist. */
export async function getResumeFromR2(resumeUrl: string): Promise<StoredResume | null> {
  if (!resumeUrl.startsWith(R2_PREFIX)) return null;
  if (!isR2Enabled()) throw new Error("Resume is stored in R2 but R2 is not configured");
  const key = resumeUrl.slice(R2_PREFIX.length);
  try {
    const out = await r2().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    if (!out.Body) return null;
    return {
      stream: out.Body as Readable,
      contentType: out.ContentType,
      contentLength: out.ContentLength,
    };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw err;
  }
}

/** Best-effort delete of an R2 resume (used for GDPR erasure). */
export async function deleteResumeFromR2(resumeUrl: string | null | undefined): Promise<void> {
  if (!resumeUrl || !resumeUrl.startsWith(R2_PREFIX) || !isR2Enabled()) return;
  await r2().send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: resumeUrl.slice(R2_PREFIX.length) }),
  );
}
