/**
 * Provisioning Worker (Cloud Run)
 *
 * A persistent BullMQ worker that processes tenant provisioning jobs
 * enqueued by the Firebase Functions backend.
 *
 * ── Deployment ───────────────────────────────────────────────────────────────
 * Deploy this as a Cloud Run service (min-instances: 1 for always-on).
 * Required environment variables (same as Firebase Functions secrets):
 *   - SERVER_DATABASE_URL — platform Neon DB connection string
 *   - NEON_BASE_URL       — Neon base URL for building tenant DB strings
 *   - REDIS_URL           — Upstash Redis or self-hosted Redis URL
 *   - SERVER_NODE_ENV     — "production" or "development"
 *
 * ── To run locally ───────────────────────────────────────────────────────────
 *   cd workers
 *   npx ts-node src/provisioningWorker.ts
 * ──────────────────────────────────────────────────────────────────────────
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { Worker, Job } from "bullmq";
import {
  PROVISIONING_QUEUE_NAME,
  ProvisionJobPayload,
  ProvisionJobResult,
} from "../../functions/src/modules/tenants/provisioningQueue";
import { provisionTenantDatabase } from "../../functions/src/modules/tenants/tenantProvisioning.service";
import { migrateTenantData } from "../../functions/src/modules/tenants/tenantMigration.service";

const REDIS_URL = process.env.REDIS_URL || process.env.SERVER_REDIS_URL;
if (!REDIS_URL) {
  console.error("[Worker] REDIS_URL is not configured — cannot start provisioning worker");
  process.exit(1);
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker<ProvisionJobPayload, ProvisionJobResult>(
  PROVISIONING_QUEUE_NAME,
  async (job: Job<ProvisionJobPayload>): Promise<ProvisionJobResult> => {
    const { tenantId, slug, triggerMigration } = job.data;

    console.log(`[Worker] Processing provisioning job ${job.id} for tenant ${tenantId}`);
    await job.updateProgress(10);

    // Step 1: Provision the database
    const provisionResult = await provisionTenantDatabase(tenantId, slug);
    await job.updateProgress(60);
    console.log(`[Worker] Provisioning complete for ${tenantId}: DB=${provisionResult.dbName}`);

    // Step 2: Optionally migrate existing data
    let migrated = false;
    if (triggerMigration) {
      await migrateTenantData(tenantId);
      migrated = true;
      await job.updateProgress(95);
      console.log(`[Worker] Data migration complete for ${tenantId}`);
    }

    await job.updateProgress(100);
    return {
      tenantId,
      dbName: provisionResult.dbName,
      provisioned: provisionResult.provisioned,
      migrated,
    };
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 2,         // process up to 2 tenants in parallel
    limiter: {
      max: 5,               // max 5 jobs per 10 seconds (rate-limit DB creation)
      duration: 10_000,
    },
  },
);

worker.on("completed", (job, result) => {
  console.log(
    `[Worker] Job ${job.id} completed: tenant=${result.tenantId} db=${result.dbName} migrated=${result.migrated}`,
  );
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err.message);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] SIGTERM received — closing worker gracefully");
  await worker.close();
  process.exit(0);
});

console.log(`[Worker] Provisioning worker started, listening on queue: ${PROVISIONING_QUEUE_NAME}`);
