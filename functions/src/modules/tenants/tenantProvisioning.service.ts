/**
 * TenantProvisioningService
 *
 * Provisions a new isolated PostgreSQL database for a tenant.
 *
 * ── What this service does ──────────────────────────────────────────────────
 * 1. Generates a safe database name from the tenant slug (zorhire_{slug})
 * 2. Creates the database via `CREATE DATABASE` on the Neon project
 * 3. Applies tenantSchema.sql to initialize all ATS tables
 * 4. Records the DB in tenant_db_registry (platform DB)
 * 5. Validates the new DB is reachable
 *
 * ── What this service does NOT do ──────────────────────────────────────────
 * It does not migrate existing data from the shared platform DB.
 * That is handled by TenantMigrationService (tenantMigration.service.ts),
 * which is run as a separate step after provisioning is confirmed healthy.
 *
 * ── Firebase Functions compatibility ───────────────────────────────────────
 * This service runs synchronously within a Firebase Function request.
 * Provisioning a new Neon database takes ~3–8 seconds, well within the
 * 60-second default timeout.
 *
 * For async/queued provisioning (BullMQ), use provisioningQueue.ts in a
 * separate Cloud Run worker — see workers/provisioningWorker.ts.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { Pool } from "pg";
import fs from "fs";
import path from "path";
import env from "../../config/env";
import { platformPool } from "../../db/platform";
import { evictTenantPool } from "../../db/tenantConnectionManager";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProvisionResult {
  tenantId: string;
  dbName: string;
  provisioned: boolean;
  alreadyExisted: boolean;
}

export interface DeprovisionResult {
  tenantId: string;
  dbName: string;
  dropped: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a tenant slug to a safe PostgreSQL database name.
 * Rules: lowercase, only [a-z0-9_], max 63 chars, prefixed with zorhire_.
 */
export function buildTenantDbName(slug: string): string {
  const sanitized = slug
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  return `zorhire_${sanitized}`;
}

/**
 * Extract the base connection URL (without database name) from DATABASE_URL.
 * Returns: postgresql://user:pass@ep-xxx.neon.tech
 */
function extractBaseConnectionUrl(): string {
  if (env.NEON_BASE_URL) {
    return env.NEON_BASE_URL.replace(/\/$/, "");
  }
  const raw = env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not configured");
  const parsed = new URL(raw);
  return `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.host}`;
}

function buildConnectionString(dbName: string): string {
  const base = extractBaseConnectionUrl();
  const isDev = env.NODE_ENV === "development";
  return `${base}/${dbName}${isDev ? "" : "?sslmode=require"}`;
}

/**
 * Load tenantSchema.sql from disk.
 * The file lives next to the compiled JS after the TypeScript build.
 */
function loadTenantSchema(): string {
  // During Firebase Function execution, __dirname is the compiled JS directory.
  // The .sql file is copied alongside the JS by the build step.
  const sqlPath = path.resolve(__dirname, "../../db/tenantSchema.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`tenantSchema.sql not found at: ${sqlPath}`);
  }
  return fs.readFileSync(sqlPath, "utf8");
}

// ─── Core provisioning ────────────────────────────────────────────────────────

/**
 * Create the physical PostgreSQL database for a tenant.
 *
 * IMPORTANT: `CREATE DATABASE` cannot run inside a transaction and cannot
 * run while connected to the database being created.  We connect to the
 * platform DB (neondb) and issue the DDL there.
 *
 * Returns true if the DB was created, false if it already existed.
 */
async function createPhysicalDatabase(dbName: string): Promise<boolean> {
  // Check if DB already exists in Neon (pg_database catalog)
  const existsResult = await platformPool.query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [dbName],
  );

  if (existsResult.rows[0].exists) {
    console.log(`[Provisioning] Database ${dbName} already exists — skipping CREATE`);
    return false;
  }

  // CREATE DATABASE cannot run inside a transaction.
  // pg Pool.query() runs outside a transaction by default — this is safe.
  // The database name is safe: sanitized by buildTenantDbName (only [a-z0-9_]).
  await platformPool.query(`CREATE DATABASE ${dbName}`);
  console.log(`[Provisioning] Created database: ${dbName}`);
  return true;
}

/**
 * Apply tenantSchema.sql to a freshly created tenant database.
 * Creates all ATS tables, indexes, and extensions.
 */
async function initializeTenantSchema(dbName: string): Promise<void> {
  const schemaSql = loadTenantSchema();
  const isDev = env.NODE_ENV === "development";

  const tenantPool = new Pool({
    connectionString: buildConnectionString(dbName),
    ssl: isDev ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 15_000,
  });

  try {
    await tenantPool.query(schemaSql);
    console.log(`[Provisioning] Schema initialized for DB: ${dbName}`);
  } catch (err: any) {
    console.error(`[Provisioning] Schema init failed for ${dbName}:`, err.message);
    throw new Error(`Failed to initialize schema for ${dbName}: ${err.message}`);
  } finally {
    await tenantPool.end();
  }
}

/**
 * Register the tenant DB in the platform DB registry.
 * Uses ON CONFLICT to make this idempotent.
 */
async function registerTenantDb(
  tenantId: string,
  dbName: string,
): Promise<void> {
  await platformPool.query(
    `INSERT INTO tenant_db_registry (tenant_id, db_name, is_provisioned, provisioned_at, migration_status)
     VALUES ($1, $2, true, now(), 'pending')
     ON CONFLICT (tenant_id) DO UPDATE SET
       db_name          = EXCLUDED.db_name,
       is_provisioned   = true,
       provisioned_at   = COALESCE(tenant_db_registry.provisioned_at, now()),
       migration_status = 'pending',
       last_error       = null,
       updated_at       = now()`,
    [tenantId, dbName],
  );
}

/**
 * Verify the tenant DB is reachable and has the expected schema.
 * Checks that the `candidates` table exists (sentinel for full schema).
 */
async function validateTenantDb(dbName: string): Promise<void> {
  const isDev = env.NODE_ENV === "development";
  const pool = new Pool({
    connectionString: buildConnectionString(dbName),
    ssl: isDev ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'candidates'
       ) AS exists`,
    );
    if (!result.rows[0].exists) {
      throw new Error(`Schema validation failed: 'candidates' table not found in ${dbName}`);
    }
    console.log(`[Provisioning] Validation passed for DB: ${dbName}`);
  } finally {
    await pool.end();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Provision a new isolated database for a tenant.
 *
 * Steps:
 *   1. Generate safe DB name from tenant slug
 *   2. Create physical Postgres database
 *   3. Initialize ATS schema
 *   4. Register in platform tenant_db_registry
 *   5. Validate the new DB
 *
 * Idempotent — calling this for an already-provisioned tenant updates the
 * registry but does not re-create or wipe the database.
 */
export async function provisionTenantDatabase(
  tenantId: string,
  slug: string,
): Promise<ProvisionResult> {
  const dbName = buildTenantDbName(slug);
  console.log(`[Provisioning] Starting provisioning for tenant ${tenantId} → ${dbName}`);

  // Check if already registered as provisioned (idempotency)
  const existing = await platformPool.query<{ db_name: string; is_provisioned: boolean }>(
    "SELECT db_name, is_provisioned FROM tenant_db_registry WHERE tenant_id = $1",
    [tenantId],
  );

  if (existing.rows.length > 0 && existing.rows[0].is_provisioned) {
    console.log(`[Provisioning] Tenant ${tenantId} already has a provisioned DB: ${existing.rows[0].db_name}`);
    return {
      tenantId,
      dbName: existing.rows[0].db_name,
      provisioned: false,
      alreadyExisted: true,
    };
  }

  // Step 1: Create the physical database
  const wasCreated = await createPhysicalDatabase(dbName);

  // Step 2: Apply schema (safe to re-run due to IF NOT EXISTS guards)
  await initializeTenantSchema(dbName);

  // Step 3: Register in platform DB
  await registerTenantDb(tenantId, dbName);

  // Step 4: Validate
  await validateTenantDb(dbName);

  // Step 5: Evict any stale cached pool entry
  await evictTenantPool(tenantId);

  console.log(`[Provisioning] Tenant ${tenantId} provisioned successfully → ${dbName}`);
  return {
    tenantId,
    dbName,
    provisioned: true,
    alreadyExisted: !wasCreated,
  };
}

/**
 * Deprovision a tenant: drop its database and remove from registry.
 *
 * DESTRUCTIVE — only call this for confirmed tenant offboarding.
 * The tenant row in `tenants` table is NOT touched by this function.
 */
export async function deprovisionTenantDatabase(
  tenantId: string,
): Promise<DeprovisionResult> {
  const registry = await platformPool.query<{ db_name: string }>(
    "SELECT db_name FROM tenant_db_registry WHERE tenant_id = $1",
    [tenantId],
  );

  if (registry.rows.length === 0) {
    return { tenantId, dbName: "", dropped: false };
  }

  const dbName = registry.rows[0].db_name;

  // Evict pool first to close all connections to the DB
  await evictTenantPool(tenantId);

  // Remove from registry
  await platformPool.query(
    "DELETE FROM tenant_db_registry WHERE tenant_id = $1",
    [tenantId],
  );

  // Drop the database
  // Force-disconnect any remaining connections before dropping
  await platformPool.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName],
  );

  await platformPool.query(`DROP DATABASE IF EXISTS ${dbName}`);

  console.log(`[Provisioning] Dropped DB ${dbName} for tenant ${tenantId}`);
  return { tenantId, dbName, dropped: true };
}

/**
 * Get the provisioning status for a tenant.
 * Returns null if no registry entry exists.
 */
export async function getTenantProvisioningStatus(tenantId: string): Promise<{
  dbName: string;
  isProvisioned: boolean;
  provisionedAt: Date | null;
  schemaVersion: number;
  migrationStatus: string | null;
  migratedAt: Date | null;
  verifiedAt: Date | null;
  lastError: string | null;
} | null> {
  const result = await platformPool.query<{
    db_name: string;
    is_provisioned: boolean;
    provisioned_at: Date | null;
    schema_version: number;
    migration_status: string | null;
    migrated_at: Date | null;
    verified_at: Date | null;
    last_error: string | null;
  }>(
    `SELECT db_name, is_provisioned, provisioned_at, schema_version,
            migration_status, migrated_at, verified_at, last_error
     FROM tenant_db_registry WHERE tenant_id = $1`,
    [tenantId],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    dbName: row.db_name,
    isProvisioned: row.is_provisioned,
    provisionedAt: row.provisioned_at,
    schemaVersion: row.schema_version,
    migrationStatus: row.migration_status,
    migratedAt: row.migrated_at,
    verifiedAt: row.verified_at,
    lastError: row.last_error,
  };
}
