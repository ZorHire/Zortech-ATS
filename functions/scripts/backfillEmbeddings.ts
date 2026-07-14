/**
 * One-off backfill: generates embeddings for existing candidates that predate the
 * A3 matching feature (embedding IS NULL). Costs real Gemini API calls against a
 * live GEMINI_API_KEY and writes to real candidate rows — dry-run by default.
 *
 * Candidates live in two places: the shared platform DB (un-provisioned tenants,
 * same physical table backend/ uses) and each provisioned tenant's own DB
 * (discovered via tenant_db_registry, same mechanism as tenantSchemaRunner.ts).
 *
 * Usage (from functions/):
 *   npx ts-node --files scripts/backfillEmbeddings.ts            # dry run — lists candidates only
 *   npx ts-node --files scripts/backfillEmbeddings.ts --confirm  # actually writes embeddings
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { Pool } from "pg";
import env from "../src/config/env";
import { platformPool } from "../src/db/platform";
import { embedText } from "../src/services/embedding.service";

const CONFIRM = process.argv.includes("--confirm");

const buildEmbeddingInput = (candidate: {
  current_title?: string | null;
  current_company?: string | null;
  summary?: string | null;
  skills?: string[] | null;
}): string =>
  [candidate.current_title, candidate.current_company, candidate.summary, (candidate.skills || []).join(", ")]
    .filter(Boolean)
    .join(". ");

const toVectorLiteral = (embedding: number[]): string => `[${embedding.join(",")}]`;

function buildTenantPool(dbName: string): Pool {
  const raw = env.NEON_BASE_URL || env.DATABASE_URL;
  const parsed = new URL(raw);
  const base = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.host}`;
  const isDev = env.NODE_ENV === "development";
  return new Pool({
    connectionString: `${base}/${dbName}${isDev ? "" : "?sslmode=require"}`,
    ssl: isDev ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 15_000,
  });
}

const backfillPool = async (
  pool: Pool,
  label: string,
): Promise<{ embedded: number; skipped: number }> => {
  const { rows } = await pool.query(
    `SELECT id, tenant_id, current_title, current_company, summary, skills
     FROM candidates
     WHERE deleted_at IS NULL AND embedding IS NULL
     ORDER BY created_at ASC`,
  );

  console.log(`[${label}] ${rows.length} candidate(s) missing an embedding.`);
  if (!CONFIRM || rows.length === 0) return { embedded: 0, skipped: 0 };

  let embedded = 0;
  let skipped = 0;
  for (const candidate of rows) {
    const input = buildEmbeddingInput(candidate);
    if (!input.trim()) {
      skipped++;
      continue;
    }
    const embedding = await embedText(input, "RETRIEVAL_DOCUMENT", candidate.tenant_id, "candidate");
    if (!embedding) {
      skipped++;
      console.warn(`  [${label}] skip ${candidate.id} — embedding generation failed`);
      continue;
    }
    await pool.query(
      `UPDATE candidates SET embedding = $1::vector, embedding_updated_at = now() WHERE id = $2`,
      [toVectorLiteral(embedding), candidate.id],
    );
    embedded++;
  }
  console.log(`[${label}] Done. Embedded ${embedded}, skipped ${skipped}.`);
  return { embedded, skipped };
};

const run = async () => {
  if (!CONFIRM) {
    console.log("Dry run — pass --confirm to actually generate and write embeddings.\n");
  }

  const totals = { embedded: 0, skipped: 0 };

  const platformResult = await backfillPool(platformPool, "platform");
  totals.embedded += platformResult.embedded;
  totals.skipped += platformResult.skipped;

  const registryResult = await platformPool.query<{ tenant_id: string; db_name: string }>(
    `SELECT tenant_id, db_name FROM tenant_db_registry WHERE is_provisioned = true ORDER BY db_name`,
  );
  console.log(`Discovered ${registryResult.rows.length} provisioned tenant DB(s).`);

  for (const { db_name: dbName } of registryResult.rows) {
    const tenantPool = buildTenantPool(dbName);
    try {
      const result = await backfillPool(tenantPool, dbName);
      totals.embedded += result.embedded;
      totals.skipped += result.skipped;
    } catch (err) {
      console.error(`[${dbName}] Backfill failed:`, err instanceof Error ? err.message : err);
    } finally {
      await tenantPool.end().catch(() => {});
    }
  }

  console.log(`\nAll done. Total embedded ${totals.embedded}, skipped ${totals.skipped}.`);
  await platformPool.end();
};

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
