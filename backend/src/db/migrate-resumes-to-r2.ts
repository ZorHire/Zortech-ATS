/**
 * One-time copy of existing resumes into the private Cloudflare R2 bucket.
 *
 *   npm run migrate-resumes-to-r2 -- --dry-run      # report only, change nothing
 *   npm run migrate-resumes-to-r2                   # copy and update resume_url
 *   npm run migrate-resumes-to-r2 -- --limit=50     # process at most 50 candidates
 *
 * Handles two legacy layouts:
 *   1. resume_url = '/uploads/resumes/<file>'  -> file on this server's UPLOAD_DIR
 *   2. resume_data BYTEA (older Firebase build) with no usable resume_url
 *
 * Safe to re-run: rows already pointing at "r2:" are skipped, and each row is
 * only updated if resume_url still has the value we read (no lost updates).
 * Original files on disk and resume_data are NOT deleted; remove them manually
 * once the copy is verified.
 */
import fs from "fs";
import path from "path";
import pool from "./index";
import env from "../config/env";
import {
  isR2Enabled,
  buildResumeKey,
  putResumeObject,
  R2_PREFIX,
} from "../services/resumeStorage";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Math.max(1, Number(limitArg.split("=")[1])) : Infinity;

const uploadRoot = path.resolve(env.UPLOAD_DIR || path.resolve(__dirname, "../uploads"));

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

function mimeFor(name: string, fallback?: string | null): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] || fallback || "application/octet-stream";
}

async function hasResumeDataColumn(): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name = 'candidates' AND column_name = 'resume_data'`,
  );
  return r.rows.length > 0;
}

async function main() {
  if (!isR2Enabled()) {
    throw new Error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.");
  }
  const withData = await hasResumeDataColumn();
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Upload dir: ${uploadRoot}`);

  const { rows } = await pool.query(
    `SELECT id, tenant_id, resume_url, created_at
            ${withData ? ", (resume_data IS NOT NULL) AS has_data, resume_mime_type" : ", false AS has_data, NULL AS resume_mime_type"}
       FROM candidates
      WHERE (resume_url LIKE '/uploads/resumes/%'
             ${withData ? "OR (resume_data IS NOT NULL AND (resume_url IS NULL OR resume_url NOT LIKE $1))" : ""})
      ORDER BY created_at`,
    withData ? [`${R2_PREFIX}%`] : [],
  );

  const stats = { candidates: rows.length, copied: 0, skipped: 0, missing: 0, failed: 0, bytes: 0 };
  let processed = 0;

  for (const row of rows) {
    if (processed >= LIMIT) break;
    processed++;
    const oldUrl: string | null = row.resume_url;

    try {
      let body: Buffer | null = null;
      let name = "resume";
      let contentType: string | undefined;

      if (oldUrl && oldUrl.startsWith("/uploads/resumes/")) {
        const filePath = path.resolve(uploadRoot, oldUrl.replace(/^\/uploads\//, ""));
        if (!filePath.startsWith(uploadRoot)) {
          console.warn(`  skip ${row.id}: path escapes upload dir`);
          stats.skipped++;
          continue;
        }
        if (fs.existsSync(filePath)) {
          body = await fs.promises.readFile(filePath);
          name = path.basename(filePath).replace(/^\d+-/, "");
          contentType = mimeFor(name);
        }
      }

      if (!body && row.has_data) {
        const d = await pool.query("SELECT resume_data FROM candidates WHERE id = $1", [row.id]);
        body = d.rows[0]?.resume_data ?? null;
        contentType = row.resume_mime_type || "application/octet-stream";
        const ext = Object.entries(MIME_BY_EXT).find(([, m]) => m === contentType)?.[0] ?? "bin";
        name = `resume.${ext}`;
      }

      if (!body) {
        console.warn(`  missing ${row.id}: no file on disk for ${oldUrl}`);
        stats.missing++;
        continue;
      }

      const key = buildResumeKey(row.tenant_id, name, new Date(row.created_at));
      if (DRY_RUN) {
        console.log(`  would copy ${row.id} (${body.length} bytes) -> ${key}`);
      } else {
        await putResumeObject(key, body, contentType || mimeFor(name));
        const upd = await pool.query(
          `UPDATE candidates SET resume_url = $1, updated_at = now()
            WHERE id = $2 AND resume_url IS NOT DISTINCT FROM $3`,
          [`${R2_PREFIX}${key}`, row.id, oldUrl],
        );
        if (upd.rowCount === 0) {
          console.warn(`  ${row.id}: resume_url changed during migration, left as is (uploaded object ${key} is unused)`);
          stats.skipped++;
          continue;
        }
      }
      stats.copied++;
      stats.bytes += body.length;
    } catch (err) {
      console.error(`  failed ${row.id}: ${(err as Error).message}`);
      stats.failed++;
    }
  }

  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Done. candidates=${stats.candidates} processed=${processed} ` +
      `copied=${stats.copied} missing=${stats.missing} skipped=${stats.skipped} failed=${stats.failed} ` +
      `size=${(stats.bytes / 1024 / 1024).toFixed(1)} MB`,
  );
  await pool.end();
  if (stats.failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
