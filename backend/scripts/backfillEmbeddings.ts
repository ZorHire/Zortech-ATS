/**
 * One-off backfill: generates embeddings for existing candidates that predate the
 * A3 matching feature (embedding IS NULL). Costs real Gemini API calls against a
 * live GEMINI_API_KEY and writes to the real candidates table — dry-run by default.
 *
 * Usage (from backend/):
 *   npx ts-node --files scripts/backfillEmbeddings.ts            # dry run — lists candidates only
 *   npx ts-node --files scripts/backfillEmbeddings.ts --confirm  # actually writes embeddings
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import pool from "../src/db";
import { embedText } from "../src/services/embedding";

const CONFIRM = process.argv.includes("--confirm");
const BATCH_SIZE = 50;

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

const run = async () => {
  const { rows } = await pool.query(
    `SELECT id, tenant_id, current_title, current_company, summary, skills
     FROM candidates
     WHERE deleted_at IS NULL AND embedding IS NULL
     ORDER BY created_at ASC`,
  );

  console.log(`Found ${rows.length} candidate(s) missing an embedding.`);
  if (!CONFIRM) {
    console.log("Dry run — pass --confirm to actually generate and write embeddings.");
    console.log(rows.slice(0, 10).map((r) => ({ id: r.id, current_title: r.current_title })));
    await pool.end();
    return;
  }

  let embedded = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    for (const candidate of batch) {
      const input = buildEmbeddingInput(candidate);
      if (!input.trim()) {
        skipped++;
        continue;
      }
      const embedding = await embedText(input, "RETRIEVAL_DOCUMENT", candidate.tenant_id, "candidate");
      if (!embedding) {
        skipped++;
        console.warn(`  [skip] ${candidate.id} — embedding generation failed`);
        continue;
      }
      await pool.query(
        `UPDATE candidates SET embedding = $1::vector, embedding_updated_at = now() WHERE id = $2`,
        [toVectorLiteral(embedding), candidate.id],
      );
      embedded++;
    }
    console.log(`Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  console.log(`Done. Embedded ${embedded}, skipped ${skipped}.`);
  await pool.end();
};

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
