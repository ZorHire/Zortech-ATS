import { Router } from "express";
import { authMiddleware, tenantIsolation, authorize } from "../../middleware/auth";
import {
  onboardCompany,
  listTenants,
  getTenant,
  setTenantStatus,
  bulkDeleteTenants,
} from "./tenants.controller";
import {
  provisionTenantDb,
  getTenantDbStatus,
  runTenantMigration,
  verifyTenantMigration,
  rollbackTenantDb,
  runSchemaOnAllTenants,
} from "./tenantProvisioning.controller";

const router = Router();

router.use(authMiddleware, tenantIsolation, authorize(["super_admin"]));

// ── Existing onboarding routes (unchanged) ────────────────────────────────
router.post("/onboard", onboardCompany);
router.post("/bulk-delete", bulkDeleteTenants);
router.get("/", listTenants);
router.get("/:id", getTenant);
router.patch("/:id/status", setTenantStatus);

// ── Schema runner (no :id prefix — must come before /:id routes) ──────────
/** Apply a DDL migration to ALL provisioned tenant DBs at once */
router.post("/run-migration", runSchemaOnAllTenants);

// ── Per-tenant provisioning routes ────────────────────────────────────────
// All routes below are ZorTech super_admin only (enforced by router-level middleware above)

/** Provision an isolated database for a specific tenant */
router.post("/:id/provision-db", provisionTenantDb);

/** Get provisioning + migration status for a tenant */
router.get("/:id/db-status", getTenantDbStatus);

/** Run data migration: copy ATS data from platform DB to tenant DB */
router.post("/:id/migrate-data", runTenantMigration);

/** Verify migration accuracy (row counts + spot-checks + null checks) */
router.get("/:id/verify-migration", verifyTenantMigration);

/** Rollback: flip is_provisioned = false, re-route to platform DB immediately */
router.post("/:id/rollback-db", rollbackTenantDb);

export default router;
