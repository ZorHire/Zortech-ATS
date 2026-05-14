/**
 * Tenant Provisioning Controller
 *
 * HTTP interface for the database-per-tenant provisioning workflow.
 * All endpoints are restricted to ZorTech super_admin (enforced at router level).
 *
 * Endpoints:
 *   POST /:id/provision-db      — provision isolated DB for a tenant
 *   GET  /:id/db-status         — get provisioning + migration status
 *   POST /:id/migrate-data      — copy ATS data from platform DB to tenant DB
 *   GET  /:id/verify-migration  — verify migration integrity (counts + spot-checks + null-checks)
 *   POST /:id/rollback-db       — flip is_provisioned = false, re-route to platform DB
 *   POST /run-migration         — apply DDL to ALL provisioned tenant DBs
 */

import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { PLATFORM_TENANT_ID } from "./tenantBootstrap.service";
import { platformPool } from "../../db/platform";
import { evictTenantPool } from "../../db/tenantConnectionManager";
import {
  provisionTenantDatabase,
  getTenantProvisioningStatus,
} from "./tenantProvisioning.service";
import {
  migrateTenantData,
  verifyMigration,
} from "./tenantMigration.service";
import { runMigrationOnAllTenants } from "./tenantSchemaRunner";

// ─── Guards ───────────────────────────────────────────────────────────────────

function assertPlatformSuperAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== "super_admin" || req.user.tenant_id !== PLATFORM_TENANT_ID) {
    res.status(403).json({ message: "Forbidden: only ZorTech super_admin can manage tenant databases" });
    return false;
  }
  return true;
}

async function getTenantSlug(tenantId: string): Promise<string | null> {
  const result = await platformPool.query<{ slug: string }>(
    "SELECT slug FROM tenants WHERE id = $1 AND is_active = true",
    [tenantId],
  );
  return result.rows[0]?.slug ?? null;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /v1/tenants/:id/provision-db
 */
export const provisionTenantDb = async (req: AuthRequest, res: Response) => {
  if (!assertPlatformSuperAdmin(req, res)) return;

  const tenantId = String(req.params.id);
  const triggerMigration = req.body?.migrate === true;
  const asyncMode = req.body?.async === true;

  try {
    const slug = await getTenantSlug(tenantId);
    if (!slug) {
      return res.status(404).json({ message: "Tenant not found or inactive" });
    }

    if (asyncMode) {
      const { enqueueProvisioning } = await import("./provisioningQueue.js");
      const result = await enqueueProvisioning({
        tenantId,
        slug,
        companyName: slug,
        triggerMigration,
      });

      return res.status(202).json({
        message: result.mode === "queued"
          ? "Provisioning job enqueued — check status via GET /:id/db-status"
          : "Provisioning completed synchronously (Redis not configured)",
        mode: result.mode,
        jobId: result.jobId,
      });
    }

    const result = await provisionTenantDatabase(tenantId, slug);

    if (result.alreadyExisted && !result.provisioned) {
      return res.json({
        message: "Tenant database already provisioned",
        tenant_id: tenantId,
        db_name: result.dbName,
        already_existed: true,
      });
    }

    res.status(201).json({
      message: "Tenant database provisioned successfully",
      tenant_id: tenantId,
      db_name: result.dbName,
      already_existed: result.alreadyExisted,
    });
  } catch (err: any) {
    console.error("[provisionTenantDb] error:", err);
    res.status(500).json({ message: "Failed to provision tenant database", error: err.message });
  }
};

/**
 * GET /v1/tenants/:id/db-status
 */
export const getTenantDbStatus = async (req: AuthRequest, res: Response) => {
  if (!assertPlatformSuperAdmin(req, res)) return;

  const tenantId = String(req.params.id);

  try {
    const status = await getTenantProvisioningStatus(tenantId);

    if (!status) {
      return res.json({
        tenant_id: tenantId,
        is_provisioned: false,
        db_name: null,
        message: "No isolated database has been provisioned for this tenant yet",
      });
    }

    res.json({
      tenant_id: tenantId,
      is_provisioned: status.isProvisioned,
      db_name: status.dbName,
      schema_version: status.schemaVersion,
      provisioned_at: status.provisionedAt,
      migration_status: status.migrationStatus,
      migrated_at: status.migratedAt,
      verified_at: status.verifiedAt,
      last_error: status.lastError,
    });
  } catch (err: any) {
    console.error("[getTenantDbStatus] error:", err);
    res.status(500).json({ message: "Failed to get tenant DB status", error: err.message });
  }
};

/**
 * POST /v1/tenants/:id/migrate-data
 */
export const runTenantMigration = async (req: AuthRequest, res: Response) => {
  if (!assertPlatformSuperAdmin(req, res)) return;

  const tenantId = String(req.params.id);

  try {
    const status = await getTenantProvisioningStatus(tenantId);
    if (!status || !status.isProvisioned) {
      return res.status(400).json({
        message: "Tenant database is not provisioned yet — run POST /:id/provision-db first",
      });
    }

    const result = await migrateTenantData(tenantId);

    res.json({
      message: "Data migration completed successfully",
      tenant_id: tenantId,
      db_name: result.dbName,
      total_rows_copied: result.totalCopied,
      duration_ms: result.durationMs,
      tables: result.tables,
    });
  } catch (err: any) {
    console.error("[runTenantMigration] error:", err);
    res.status(500).json({ message: "Data migration failed", error: err.message });
  }
};

/**
 * GET /v1/tenants/:id/verify-migration
 *
 * Enhanced: row counts + MD5 spot-checks (50 PKs per table) + null checks on
 * required columns.  Sets migration_status = 'live' on pass, 'failed' on mismatch.
 */
export const verifyTenantMigration = async (req: AuthRequest, res: Response) => {
  if (!assertPlatformSuperAdmin(req, res)) return;

  const tenantId = String(req.params.id);

  try {
    const status = await getTenantProvisioningStatus(tenantId);
    if (!status || !status.isProvisioned) {
      return res.status(400).json({ message: "Tenant database is not provisioned" });
    }

    const result = await verifyMigration(tenantId);

    res.json({
      tenant_id: tenantId,
      verification_passed: result.passed,
      checks: result.checks,
      summary: result.passed
        ? "All checks passed (row counts, spot-checks, null constraints) — tenant is live"
        : "Verification failed — check the 'checks' array for details and re-run migration",
    });
  } catch (err: any) {
    console.error("[verifyTenantMigration] error:", err);
    res.status(500).json({ message: "Verification failed", error: err.message });
  }
};

/**
 * POST /v1/tenants/:id/rollback-db
 *
 * Instantly re-routes tenant traffic back to the platform DB by flipping
 * is_provisioned = false.  The tenant DB is NOT deleted — data is preserved.
 * Use after a verification failure, performance incident, or corruption.
 */
export const rollbackTenantDb = async (req: AuthRequest, res: Response) => {
  if (!assertPlatformSuperAdmin(req, res)) return;

  const tenantId = String(req.params.id);

  try {
    const status = await getTenantProvisioningStatus(tenantId);
    if (!status) {
      return res.status(404).json({ message: "No tenant DB registry entry found for this tenant" });
    }

    await platformPool.query(
      `UPDATE tenant_db_registry
       SET is_provisioned   = false,
           migration_status = 'pending',
           last_error       = null,
           updated_at       = now()
       WHERE tenant_id = $1`,
      [tenantId],
    );

    // Evict the pool so the next request re-reads the registry (falls back to platform pool)
    await evictTenantPool(tenantId);

    res.json({
      message: "Rollback successful — tenant traffic now routes to platform DB",
      tenant_id: tenantId,
      db_name: status.dbName,
      note: "Tenant DB data is preserved. Re-run provision-db → migrate-data → verify-migration to restore.",
    });
  } catch (err: any) {
    console.error("[rollbackTenantDb] error:", err);
    res.status(500).json({ message: "Rollback failed", error: err.message });
  }
};

/**
 * POST /v1/tenants/run-migration
 *
 * Apply a DDL migration to ALL provisioned tenant databases.
 * Body: { sql: string, version?: string }
 *
 * Does NOT stop on first failure — reports per-tenant success/error.
 * Pass `version` to record the migration in each tenant's schema_migrations table.
 */
export const runSchemaOnAllTenants = async (req: AuthRequest, res: Response) => {
  if (!assertPlatformSuperAdmin(req, res)) return;

  const { sql, version } = req.body as { sql?: string; version?: string };

  if (!sql || typeof sql !== "string" || sql.trim().length === 0) {
    return res.status(400).json({ message: "Body must include a non-empty 'sql' string" });
  }

  try {
    const result = await runMigrationOnAllTenants(sql, version);

    const statusCode = result.failed > 0 ? 207 : 200;
    res.status(statusCode).json({
      message: result.failed === 0
        ? `Migration applied to all ${result.total} tenant DB(s) successfully`
        : `Migration completed with ${result.failed} failure(s) — see 'results' for details`,
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      version: version ?? null,
      results: result.results,
    });
  } catch (err: any) {
    console.error("[runSchemaOnAllTenants] error:", err);
    res.status(500).json({ message: "Schema runner failed", error: err.message });
  }
};
