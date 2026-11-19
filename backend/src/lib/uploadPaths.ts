import fs from "fs";
import path from "path";
import env from "../config/env";

/**
 * Uploaded files are NOT served by a public/static route: each file type has its
 * own endpoint that first checks the requesting user's tenant owns the record
 * (candidate resume, vendor document, user avatar). These helpers turn the
 * stored "/uploads/<relative>" value into an absolute path safely.
 */

/** Primary upload root (Docker volume in production). */
export const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR || path.resolve(__dirname, "../uploads"));

/**
 * Older code wrote some files to backend/uploads (relative to the module),
 * which differs from UPLOAD_ROOT. Lookups also check there so those files
 * keep working until they're migrated.
 */
export const LEGACY_UPLOAD_ROOT = path.resolve(__dirname, "../../uploads");

/** Folder for a kind of upload under UPLOAD_ROOT, created on first use. */
export function uploadSubdir(name: string): string {
  const dir = path.resolve(UPLOAD_ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep);
}

/**
 * Resolve a stored "/uploads/..." path to an existing file inside one of the
 * allowed roots, or null. Rejects anything that would escape the roots
 * (e.g. "/uploads/../../etc/passwd" or a sibling folder like "uploads-old").
 */
export function resolveStoredUpload(
  storedPath: string | null | undefined,
  roots: string[] = [UPLOAD_ROOT, LEGACY_UPLOAD_ROOT],
): string | null {
  if (!storedPath || !storedPath.startsWith("/uploads/")) return null;
  const relative = storedPath.slice("/uploads/".length);
  if (!relative || relative.includes("\0")) return null;

  for (const root of roots) {
    const candidate = path.resolve(root, relative);
    if (!isInside(root, candidate)) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Filesystem-safe name that keeps the original extension. */
export function safeUploadName(originalName: string): string {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
}
