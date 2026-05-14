/**
 * TenantSchemaRunner
 *
 * Applies a DDL migration to ALL provisioned tenant databases.
 * Designed for Section 8 of the DB restructure spec: every future schema
 * change (new columns, indexes, tables) must be pushed to all tenant DBs.
 *
 * Behaviour:
 *   1. Discover all provisioned tenant DBs from tenant_db_registry
 *   2. Run the SQL against each DB sequentially (avoids connection storms)
 *   3. Record success / failure per tenant — never stops on first failure
 *   4. Optionally insert a row into schema_migrations to track applied version
 *   5. Return a full per-tenant report so failures can be re-run individually
 */

import { Pool } from "pg";
import env from "../../config/env";
import { platformPool } from "../../db/platform";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TenantMigrationOutcome {
  tenantId: string;
  dbName: string;
  success: boolean;
  error?: string;
}

export interface SchemaRunnerResult {
  total: number;
  succeeded: number;
  failed: number;
  results: TenantMigrationOutcome[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a SQL migration against every provisioned tenant DB.
 *
 * @param migrationSql  Raw DDL/DML to execute on each tenant DB.
 * @param version       Optional migration version label (e.g. "006").
 *                      If provided, inserts into schema_migrations table after
 *                      successful apply (idempotent — ON CONFLICT DO NOTHING).
 */
export async function runMigrationOnAllTenants(
  migrationSql: string,
  version?: string,
): Promise<SchemaRunnerResult> {
  // Phase 1: Discover all provisioned tenant DBs
  const registryResult = await platformPool.query<{ tenant_id: string; db_name: string }>(
    `SELECT tenant_id, db_name FROM tenant_db_registry
     WHERE is_provisioned = true
     ORDER BY db_name`,
  );

  const tenants = registryResult.rows;
  console.log(`[SchemaRunner] Discovered ${tenants.length} provisioned tenant DB(s)`);

  const results: TenantMigrationOutcome[] = [];

  // Phase 2 & 3: Apply sequentially; record success/failure per tenant
  for (const { tenant_id: tenantId, db_name: dbName } of tenants) {
    const pool = buildTenantPool(dbName);
    try {
      await pool.query(migrationSql);

      // Phase 5: Track applied version in schema_migrations (if provided)
      if (version) {
        await pool.query(
          `INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`,
          [version],
        ).catch((err) =>
          console.warn(
            `[SchemaRunner] schema_migrations insert failed for ${dbName} (non-fatal):`,
            err.message,
          ),
        );
      }

      results.push({ tenantId, dbName, success: true });
      console.log(`[SchemaRunner] ✓ ${dbName} (tenant ${tenantId})`);
    } catch (err: any) {
      const msg = err.message ?? "Unknown error";
      results.push({ tenantId, dbName, success: false, error: msg });
      console.error(`[SchemaRunner] ✗ ${dbName} (tenant ${tenantId}):`, msg);
    } finally {
      await pool.end().catch(() => {});
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.length - succeeded;

  // Phase 4: Surface failures clearly
  if (failed > 0) {
    console.error(
      `[SchemaRunner] ${failed} tenant DB(s) failed. Re-run against individual tenants:`,
      results.filter((r) => !r.success).map((r) => `${r.dbName}: ${r.error}`).join(" | "),
    );
  } else {
    console.log(`[SchemaRunner] All ${succeeded} tenant DB(s) migrated successfully.`);
  }

  return { total: tenants.length, succeeded, failed, results };
}
