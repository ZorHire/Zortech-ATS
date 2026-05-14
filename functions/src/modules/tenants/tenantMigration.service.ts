/**
 * TenantMigrationService
 *
 * Copies existing ATS data for one tenant from the shared platform DB into the
 * tenant's newly provisioned isolated database.
 *
 * ── Safety guarantee ────────────────────────────────────────────────────────
 * This migration is READ-ONLY from the platform DB.  It never deletes or
 * modifies data in the source (platform) DB.  Data in the source remains
 * available until you explicitly remove it after cutover is confirmed.
 *
 * ── Phases ──────────────────────────────────────────────────────────────────
 * 1. migrateTenantData(tenantId) — copies all ATS rows for a tenant
 * 2. verifyMigration(tenantId)   — row counts + spot-checks + null checks
 * 3. cutoverTenant(tenantId)     — marks tenant as "fully migrated" in registry
 *
 * ── migration_status lifecycle ──────────────────────────────────────────────
 * pending → migrating → verifying → live
 *                    ↘ failed      ↗
 * ──────────────────────────────────────────────────────────────────────────
 */

import { Pool, PoolClient } from "pg";
import env from "../../config/env";
import { platformPool } from "../../db/platform";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MigrationTableResult {
  table: string;
  rowsCopied: number;
  rowsSkipped: number;
}

export interface MigrationResult {
  tenantId: string;
  dbName: string;
  tables: MigrationTableResult[];
  totalCopied: number;
  durationMs: number;
}

export interface VerificationCheck {
  table: string;
  sourceCount: number;
  targetCount: number;
  match: boolean;
  spotCheck?: { sourceHash: string; targetHash: string; match: boolean };
  nullViolations?: { column: string; count: number }[];
}

export interface VerificationResult {
  tenantId: string;
  passed: boolean;
  checks: VerificationCheck[];
}

// ─── Null-check columns per table ────────────────────────────────────────────
// These are NOT NULL columns whose integrity we verify in the tenant DB.

const NULL_CHECK_COLUMNS: Record<string, string[]> = {
  candidates:          ["first_name", "last_name"],
  jobs:                ["title"],
  clients:             ["name"],
  vendors:             ["company_name", "primary_contact_name", "primary_contact_email"],
  job_applications:    ["job_id", "candidate_id", "stage"],
  pipeline_events:     ["application_id", "to_stage"],
  interviews:          ["application_id", "interview_type", "scheduled_at", "status"],
  email_campaigns:     ["name", "subject", "body", "status"],
  client_stakeholders: ["client_id", "name"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTenantPool(dbName: string): Pool {
  const raw = env.NEON_BASE_URL || env.DATABASE_URL;
  const parsed = new URL(raw);
  const base = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.host}`;
  const isDev = env.NODE_ENV === "development";
  return new Pool({
    connectionString: `${base}/${dbName}${isDev ? "" : "?sslmode=require"}`,
    ssl: isDev ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
    max: 2,
    connectionTimeoutMillis: 15_000,
  });
}

async function getTenantDbName(tenantId: string): Promise<string> {
  const result = await platformPool.query<{ db_name: string }>(
    "SELECT db_name FROM tenant_db_registry WHERE tenant_id = $1 AND is_provisioned = true",
    [tenantId],
  );
  if (result.rows.length === 0) {
    throw new Error(`Tenant ${tenantId} has no provisioned DB — run provisionTenantDatabase first`);
  }
  return result.rows[0].db_name;
}

async function setMigrationStatus(
  tenantId: string,
  status: "pending" | "migrating" | "verifying" | "live" | "failed",
  extra: { migrated_at?: boolean; verified_at?: boolean; last_error?: string | null } = {},
): Promise<void> {
  const sets: string[] = ["migration_status = $2", "updated_at = now()"];
  const params: any[] = [tenantId, status];

  if (extra.migrated_at) {
    sets.push(`migrated_at = now()`);
    sets.push(`last_migrated_at = now()`);
  }
  if (extra.verified_at) {
    sets.push(`verified_at = now()`);
  }
  if ("last_error" in extra) {
    params.push(extra.last_error ?? null);
    sets.push(`last_error = $${params.length}`);
  }

  await platformPool.query(
    `UPDATE tenant_db_registry SET ${sets.join(", ")} WHERE tenant_id = $1`,
    params,
  ).catch((err) =>
    console.warn(`[Migration] Failed to set migration_status=${status} for ${tenantId}:`, err.message),
  );
}

/**
 * Copy rows for one table from platform DB to tenant DB.
 * Uses INSERT ... ON CONFLICT DO NOTHING so it is safe to re-run.
 */
async function copyTable(
  tableName: string,
  tenantId: string,
  srcPool: Pool,
  dstClient: PoolClient,
): Promise<MigrationTableResult> {
  const selectResult = await srcPool.query(
    `SELECT * FROM ${tableName} WHERE tenant_id = $1`,
    [tenantId],
  );

  const rows = selectResult.rows;
  if (rows.length === 0) {
    return { table: tableName, rowsCopied: 0, rowsSkipped: 0 };
  }

  const columns = Object.keys(rows[0]);
  const placeholders = rows.map(
    (_, rowIdx) =>
      `(${columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`).join(", ")})`,
  );

  const values = rows.flatMap((row) => columns.map((col) => row[col]));

  const insertSql = `
    INSERT INTO ${tableName} (${columns.join(", ")})
    VALUES ${placeholders.join(", ")}
    ON CONFLICT DO NOTHING
  `;

  await dstClient.query(insertSql, values);

  return { table: tableName, rowsCopied: rows.length, rowsSkipped: 0 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Migrate all ATS data for one tenant from the platform DB to their isolated DB.
 *
 * Safe to re-run — all inserts use ON CONFLICT DO NOTHING.
 * Does NOT delete source data.
 *
 * Sets migration_status: pending → migrating → verifying (on success)
 *                                             → failed    (on error)
 */
export async function migrateTenantData(tenantId: string): Promise<MigrationResult> {
  const startTime = Date.now();
  const dbName = await getTenantDbName(tenantId);

  console.log(`[Migration] Starting data migration for tenant ${tenantId} → ${dbName}`);

  await setMigrationStatus(tenantId, "migrating", { last_error: null });

  const tenantPool = buildTenantPool(dbName);
  const dstClient = await tenantPool.connect();

  const results: MigrationTableResult[] = [];

  try {
    await dstClient.query("BEGIN");

    // Migration order respects FK dependencies within the tenant DB
    const tableMigrationOrder = [
      "vendors",             // no internal FKs
      "clients",             // no internal FKs
      "client_stakeholders", // FK → clients
      "jobs",                // FK → clients
      "candidates",          // no internal FKs
      "job_applications",    // FK → jobs, candidates
      "pipeline_events",     // FK → job_applications
      "interviews",          // FK → job_applications
      "email_campaigns",     // no internal FKs
    ];

    for (const table of tableMigrationOrder) {
      const result = await copyTable(table, tenantId, platformPool, dstClient);
      results.push(result);
      console.log(`[Migration] ${table}: ${result.rowsCopied} rows copied`);
    }

    await dstClient.query("COMMIT");

    const totalCopied = results.reduce((sum, r) => sum + r.rowsCopied, 0);
    const durationMs = Date.now() - startTime;

    await setMigrationStatus(tenantId, "verifying", { migrated_at: true, last_error: null });

    console.log(
      `[Migration] Tenant ${tenantId} migration complete: ${totalCopied} total rows in ${durationMs}ms`,
    );

    return { tenantId, dbName, tables: results, totalCopied, durationMs };
  } catch (err: any) {
    await dstClient.query("ROLLBACK").catch(() => {});
    const msg = err.message ?? "Unknown error";
    console.error(`[Migration] Migration failed for tenant ${tenantId}:`, msg);
    await setMigrationStatus(tenantId, "failed", { last_error: msg.slice(0, 1000) });
    throw new Error(`Migration failed for tenant ${tenantId}: ${msg}`);
  } finally {
    dstClient.release();
    await tenantPool.end();
  }
}

/**
 * Verify migration integrity with three checks per table:
 *   1. Row count — tenant DB count must equal platform DB count for that tenant
 *   2. Spot-check — MD5 hash of first 50 PKs (ordered) must match
 *   3. Null check — key NOT NULL columns must have zero nulls in tenant DB
 *
 * Sets migration_status: verifying → live (all checks pass)
 *                                  → failed (any check fails)
 */
export async function verifyMigration(tenantId: string): Promise<VerificationResult> {
  const dbName = await getTenantDbName(tenantId);
  const tenantPool = buildTenantPool(dbName);

  const tables = [
    "clients",
    "client_stakeholders",
    "jobs",
    "candidates",
    "job_applications",
    "pipeline_events",
    "interviews",
    "vendors",
    "email_campaigns",
  ];

  const checks: VerificationCheck[] = [];

  try {
    for (const table of tables) {
      // ── 1. Row count ──────────────────────────────────────────────────────
      const [srcCount, dstCount] = await Promise.all([
        platformPool.query<{ count: string }>(
          `SELECT COUNT(*)::int AS count FROM ${table} WHERE tenant_id = $1`,
          [tenantId],
        ),
        tenantPool.query<{ count: string }>(
          `SELECT COUNT(*)::int AS count FROM ${table} WHERE tenant_id = $1`,
          [tenantId],
        ),
      ]);

      const sourceCount = Number(srcCount.rows[0].count);
      const targetCount = Number(dstCount.rows[0].count);
      const countMatch = sourceCount === targetCount;

      const check: VerificationCheck = { table, sourceCount, targetCount, match: countMatch };

      // ── 2. Spot-check (first 50 PKs by UUID natural order) ────────────────
      if (sourceCount > 0) {
        const spotSql = `
          SELECT md5(COALESCE(array_agg(id::text ORDER BY id)::text, '')) AS hash
          FROM (SELECT id FROM ${table} WHERE tenant_id = $1 ORDER BY id LIMIT 50) t
        `;
        const [srcHash, dstHash] = await Promise.all([
          platformPool.query<{ hash: string }>(spotSql, [tenantId]),
          tenantPool.query<{ hash: string }>(spotSql, [tenantId]),
        ]);
        const sh = srcHash.rows[0].hash;
        const dh = dstHash.rows[0].hash;
        check.spotCheck = { sourceHash: sh, targetHash: dh, match: sh === dh };
        if (!check.spotCheck.match) check.match = false;
      }

      // ── 3. Null checks on required columns (target DB only) ───────────────
      const nullCols = NULL_CHECK_COLUMNS[table];
      if (nullCols && targetCount > 0) {
        const nullViolations: { column: string; count: number }[] = [];
        for (const col of nullCols) {
          const nullResult = await tenantPool.query<{ count: string }>(
            `SELECT COUNT(*)::int AS count FROM ${table} WHERE tenant_id = $1 AND ${col} IS NULL`,
            [tenantId],
          );
          const nullCount = Number(nullResult.rows[0].count);
          if (nullCount > 0) {
            nullViolations.push({ column: col, count: nullCount });
            check.match = false;
          }
        }
        if (nullViolations.length > 0) check.nullViolations = nullViolations;
      }

      checks.push(check);
    }

    const passed = checks.every((c) => c.match);

    if (passed) {
      await setMigrationStatus(tenantId, "live", { verified_at: true, last_error: null });
      console.log(`[Migration] Verification passed for tenant ${tenantId} — status → live`);
    } else {
      const failures = checks
        .filter((c) => !c.match)
        .map((c) => {
          const parts = [`${c.table}: count ${c.sourceCount}→${c.targetCount}`];
          if (c.spotCheck && !c.spotCheck.match) parts.push("spot-check mismatch");
          if (c.nullViolations?.length) parts.push(`null violations: ${c.nullViolations.map((n) => n.column).join(", ")}`);
          return parts.join("; ");
        })
        .join(" | ");
      await setMigrationStatus(tenantId, "failed", { last_error: failures.slice(0, 1000) });
      console.warn(`[Migration] Verification FAILED for tenant ${tenantId}:`, failures);
    }

    return { tenantId, passed, checks };
  } finally {
    await tenantPool.end();
  }
}

/**
 * Mark a tenant as fully migrated in the registry.
 * After this, TenantConnectionManager will route all requests for this
 * tenant to the isolated tenant DB instead of the platform DB.
 *
 * ONLY call this after verifyMigration() passes and you are ready to cut over.
 */
export async function markTenantMigrated(tenantId: string): Promise<void> {
  await setMigrationStatus(tenantId, "live", { verified_at: true, last_error: null });
  console.log(`[Migration] Tenant ${tenantId} marked as migrated/cut-over`);
}
