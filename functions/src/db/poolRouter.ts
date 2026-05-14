import { Pool } from "pg";
import { platformPool } from "./platform";
import { getTenantPool, TenantDbNotProvisionedError } from "./tenantConnectionManager";

/**
 * Returns the ATS (per-tenant) pool for the given tenant, falling back to the
 * shared platform pool when the tenant's isolated database has not been provisioned yet.
 *
 * This is the central routing function for the DB-per-tenant migration.
 * It lets all ATS controllers be forward-compatible with tenant isolation while
 * remaining fully backward-compatible with the existing platform DB layout.
 *
 * Pass null/undefined for platform-owner cross-tenant reads — those always use
 * the platform pool and rely on the (col IS NULL OR col = $N) filter pattern.
 */
export async function getAtsPool(tenantId: string | null | undefined): Promise<Pool> {
  if (!tenantId) return platformPool;
  try {
    return await getTenantPool(tenantId);
  } catch (err) {
    // Fall back to the shared platform pool when the tenant DB is not provisioned
    // OR when tenant_db_registry table doesn't exist yet (migration pending, code=42P01).
    if (
      err instanceof TenantDbNotProvisionedError ||
      (err as any)?.code === "42P01"
    ) {
      return platformPool;
    }
    throw err;
  }
}
