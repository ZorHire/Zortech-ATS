/**
 * Provisioning Queue (BullMQ)
 *
 * ── IMPORTANT: Firebase Functions Incompatibility ─────────────────────────
 * BullMQ workers require a PERSISTENT process.  Firebase Cloud Functions are
 * ephemeral and cannot host a persistent BullMQ worker.
 *
 * THIS FILE provides:
 *   1. The queue PRODUCER (enqueueProvisioning) — safe to call from Firebase
 *      Functions because it only adds a job to Redis (fire-and-forget).
 *   2. The queue DEFINITION (PROVISIONING_QUEUE_NAME) shared with the worker.
 *
 * The CONSUMER (worker) must run in a separate, always-on process:
 *   - Cloud Run service (recommended)
 *   - A separate Node.js process
 *   - See: workers/provisioningWorker.ts
 *
 * If REDIS_URL is not configured, all enqueue calls fall back to synchronous
 * provisioning so the system stays functional without Redis.
 * ──────────────────────────────────────────────────────────────────────────
 */

import env from "../../config/env";
import { provisionTenantDatabase } from "./tenantProvisioning.service";

export const PROVISIONING_QUEUE_NAME = "tenant-provisioning";

// ─── Job payload types ────────────────────────────────────────────────────────

export interface ProvisionJobPayload {
  tenantId: string;
  slug: string;
  companyName: string;
  triggerMigration: boolean;
}

export interface ProvisionJobResult {
  tenantId: string;
  dbName: string;
  provisioned: boolean;
  migrated: boolean;
}

// ─── Dynamic BullMQ import ────────────────────────────────────────────────────

// BullMQ is an optional dependency — imported dynamically so the Firebase
// Functions bundle compiles without requiring bullmq to be installed.
// Install bullmq only on the Cloud Run worker: cd workers && npm install bullmq

let _Queue: any = null;

async function getBullMQQueue(): Promise<any | null> {
  if (!env.REDIS_URL) return null;
  try {
    if (!_Queue) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const bullmq = require("bullmq") as { Queue: any };
      _Queue = bullmq.Queue;
    }
    return new _Queue(PROVISIONING_QUEUE_NAME, {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  } catch {
    // BullMQ not installed — this is expected in the Firebase Functions environment
    return null;
  }
}

// ─── Producer ─────────────────────────────────────────────────────────────────

/**
 * Enqueue a tenant provisioning job.
 *
 * If Redis is configured (REDIS_URL set) and BullMQ is installed, the job is
 * added to the queue and processed by the Cloud Run worker asynchronously.
 *
 * If Redis is NOT configured (or BullMQ unavailable), provisioning runs
 * synchronously in the current request — safe for Firebase Functions since
 * provisioning takes < 10 seconds.
 */
export async function enqueueProvisioning(
  payload: ProvisionJobPayload,
): Promise<{ mode: "queued" | "completed"; jobId?: string }> {
  const queue = await getBullMQQueue();

  if (queue) {
    const job = await queue.add("provision", payload, {
      jobId: `provision-${payload.tenantId}`,
    });
    await queue.close();
    console.log(`[ProvisioningQueue] Job enqueued: ${job.id} for tenant ${payload.tenantId}`);
    return { mode: "queued", jobId: job.id };
  }

  // Synchronous fallback
  console.log(
    `[ProvisioningQueue] Redis not configured — running synchronous provisioning for tenant ${payload.tenantId}`,
  );

  await provisionTenantDatabase(payload.tenantId, payload.slug);

  if (payload.triggerMigration) {
    // Dynamic import to avoid circular dependency issues at module load time
    const { migrateTenantData } = await import("./tenantMigration.service.js");
    await migrateTenantData(payload.tenantId);
  }

  return { mode: "completed" };
}
