/**
 * TenantConnectionManager
 *
 * Manages per-tenant PostgreSQL connection pools for the database-per-tenant
 * architecture.  Each tenant's ATS data lives in its own database; this module
 * resolves the correct pool for a given tenant_id on every request.
 *
 * ── Design for Firebase Cloud Functions ──────────────────────────────────────
 * Firebase Functions are stateless but instances are reused (warm start).
 * The `tenantPools` Map lives in module scope and persists for the lifetime of
 * a warm instance.  On a cold start the map is empty and is rebuilt lazily —
 * one platform-DB lookup per tenant, per cold start.  This is acceptable:
 * the lookup is a single PK query on `tenant_db_registry` (~5 ms on Neon).
 *
 * ── Pool sizing ──────────────────────────────────────────────────────────────
 * max: 2 — same as the platform pool.  Each Firebase Function instance handles
 * one request at a time, so two connections per pool (one active + one idle)
 * is sufficient and avoids exhausting Neon's per-project connection limit.
 *
 * ── Tenant DB not yet provisioned ────────────────────────────────────────────
 * If a tenant has no entry in tenant_db_registry (or is_provisioned = false),
 * getTenantPool throws a TenantDbNotProvisionedError.  Callers can catch this
 * and fall back to the platform pool during the migration transition period.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import env from "../config/env";
import { platformPool } from "./platform";

// ─── Types ────────────────────────────────────────────────────────────────────

export class TenantDbNotProvisionedError extends Error {
  constructor(public readonly tenantId: string) {
    super(`Tenant DB not provisioned for tenant: ${tenantId}`);
    this.name = "TenantDbNotProvisionedError";
  }
}

export interface TenantPoolEntry {
  pool: Pool;
  dbName: string;
  createdAt: Date;
  lastUsed: Date;
}

// ─── Module-scope pool cache (survives warm instance reuse) ───────────────────

const tenantPools = new Map<string, TenantPoolEntry>();

// TTL-based eviction: close pools idle for more than 10 minutes.
const POOL_IDLE_EVICT_MS = 10 * 60 * 1000;

// LRU cap: evict the least-recently-used pool when this limit is reached.
// Prevents unbounded connection growth as tenant count scales.
const MAX_POOLS = 50;

// ─── Connection string helpers ────────────────────────────────────────────────

/**
 * Derive the base Neon connection URL (everything before the database name)
 * from the platform DATABASE_URL.  Falls back to NEON_BASE_URL if set.
 *
 * Input:  postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
 * Output: postgresql://user:pass@ep-xxx.neon.tech
 */
function extractNeonBaseUrl(): string {
  if (env.NEON_BASE_URL) {
    return env.NEON_BASE_URL.replace(/\/$/, "");
  }
  const raw = env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set — cannot derive Neon base URL for tenant connections",
    );
  }
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.host}`;
  } catch {
    throw new Error(`Invalid DATABASE_URL format: cannot extract base URL`);
  }
}

function buildTenantConnectionString(dbName: string): string {
  const base = extractNeonBaseUrl();
  return `${base}/${dbName}?sslmode=require`;
}

// ─── Pool factory ─────────────────────────────────────────────────────────────

function createPoolForDb(dbName: string): Pool {
  const connectionString = buildTenantConnectionString(dbName);
  const isDev = env.NODE_ENV === "development";

  const pool = new Pool({
    connectionString,
    ssl: isDev ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
    max: 2,
    idleTimeoutMillis: 600_000,   // 10 min — matches platform pool
    connectionTimeoutMillis: 10_000,
  });

  pool.on("error", (err) => {
    console.error(`[TenantPool:${dbName}] Unexpected pool error:`, err.message);
  });

  return pool;
}

// ─── LRU helpers ──────────────────────────────────────────────────────────────

// Move a cache hit to the end of the Map so it is treated as most-recently-used.
// Map preserves insertion order, so the first entry is always the LRU candidate.
function touchEntry(tenantId: string, entry: TenantPoolEntry): void {
  entry.lastUsed = new Date();
  tenantPools.delete(tenantId);
  tenantPools.set(tenantId, entry);
}

// Evict the least-recently-used pool when the cap is exceeded.
function evictLruPool(): void {
  const firstKey = tenantPools.keys().next().value;
  if (!firstKey) return;
  const entry = tenantPools.get(firstKey)!;
  entry.pool.end().catch((err) =>
    console.warn(`[TenantPool] Pool end error during LRU eviction for ${firstKey}:`, err.message),
  );
  tenantPools.delete(firstKey);
  console.log(`[TenantPool] LRU evicted pool for tenant ${firstKey} (cap=${MAX_POOLS})`);
}

// ─── TTL eviction ─────────────────────────────────────────────────────────────

function evictIdlePools(): void {
  const now = Date.now();
  for (const [tenantId, entry] of tenantPools.entries()) {
    if (now - entry.lastUsed.getTime() > POOL_IDLE_EVICT_MS) {
      entry.pool.end().catch((err) =>
        console.warn(`[TenantPool] Pool end error during TTL eviction for ${tenantId}:`, err.message),
      );
      tenantPools.delete(tenantId);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the connection pool for a provisioned tenant.
 *
 * On first call for a tenant_id (cold start or evicted entry):
 *   1. Queries platform DB for the tenant's db_name
 *   2. Builds and caches a new Pool
 *   3. Returns it
 *
 * On subsequent calls within the same function instance: O(1) Map lookup.
 *
 * @throws TenantDbNotProvisionedError — tenant has no provisioned DB yet
 */
export async function getTenantPool(tenantId: string): Promise<Pool> {
  evictIdlePools();

  const cached = tenantPools.get(tenantId);
  if (cached) {
    touchEntry(tenantId, cached); // move to MRU position
    return cached.pool;
  }

  // Fetch db_name from platform registry
  const result = await platformPool.query<{ db_name: string }>(
    `SELECT db_name FROM tenant_db_registry
     WHERE tenant_id = $1 AND is_provisioned = true
     LIMIT 1`,
    [tenantId],
  );

  if (result.rows.length === 0) {
    throw new TenantDbNotProvisionedError(tenantId);
  }

  const dbName = result.rows[0].db_name;
  const pool = createPoolForDb(dbName);

  // Enforce LRU cap before inserting a new entry
  if (tenantPools.size >= MAX_POOLS) {
    evictLruPool();
  }

  tenantPools.set(tenantId, {
    pool,
    dbName,
    createdAt: new Date(),
    lastUsed: new Date(),
  });

  console.log(`[TenantPool] Created pool for tenant ${tenantId} → DB: ${dbName}`);
  return pool;
}

/**
 * Typed wrapper around pool.query for convenience.
 * Automatically resolves the correct tenant pool.
 */
export async function tenantQuery<R extends QueryResultRow = any>(
  tenantId: string,
  text: string,
  params?: any[],
): Promise<QueryResult<R>> {
  const pool = await getTenantPool(tenantId);
  return pool.query<R>(text, params);
}

/**
 * Acquire a client from the tenant pool (for transactions).
 * Caller MUST call client.release() in a finally block.
 */
export async function getTenantClient(tenantId: string): Promise<PoolClient> {
  const pool = await getTenantPool(tenantId);
  return pool.connect();
}

/**
 * Explicitly evict and close the pool for a given tenant.
 * Call this after deprovisioning a tenant DB.
 */
export async function evictTenantPool(tenantId: string): Promise<void> {
  const entry = tenantPools.get(tenantId);
  if (entry) {
    await entry.pool.end();
    tenantPools.delete(tenantId);
    console.log(`[TenantPool] Evicted pool for tenant ${tenantId}`);
  }
}

/**
 * Gracefully close ALL tenant pools.
 * Call during process shutdown if needed (e.g., in tests).
 */
export async function closeAllTenantPools(): Promise<void> {
  const closers = Array.from(tenantPools.entries()).map(async ([id, entry]) => {
    try {
      await entry.pool.end();
    } catch (err: any) {
      console.warn(`[TenantPool] Error closing pool for tenant ${id}:`, err.message);
    }
  });
  await Promise.all(closers);
  tenantPools.clear();
}

/**
 * Health-check: verify a tenant pool can reach its database.
 * Used in provisioning validation and health endpoints.
 */
export async function pingTenantPool(tenantId: string): Promise<boolean> {
  try {
    const pool = await getTenantPool(tenantId);
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * List all currently cached tenant pools (diagnostic only).
 */
export function listCachedPools(): Array<{ tenantId: string; dbName: string; lastUsed: Date }> {
  return Array.from(tenantPools.entries()).map(([tenantId, entry]) => ({
    tenantId,
    dbName: entry.dbName,
    lastUsed: entry.lastUsed,
  }));
}
