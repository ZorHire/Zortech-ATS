// Derived from actual route-level authorize() calls across all route files.
// Update this map when new routes or roles are added — do not invent permissions
// that don't have a corresponding route guard.
//
// Permission naming convention: resource:action
// "*" means unrestricted (super_admin wildcard only).

export const rolePermissions: Record<string, string[]> = {
  // ── Super admin ────────────────────────────────────────────────────────────
  super_admin: ["*"],

  // ── Accounts Manager ──────────────────────────────────────────────────────
  // Full platform access except the wildcard. Mirrors every authorize() list
  // across admin, clients, vendors, jobs, candidates, pipeline, and email routes.
  accounts_manager: [
    "user:view", "user:create", "user:update", "user:delete", "user:reset_password",
    "candidate:view", "candidate:create", "candidate:update", "candidate:delete", "candidate:export",
    "job:view", "job:create", "job:update", "job:delete",
    "client:view", "client:create", "client:update", "client:delete",
    "vendor:view", "vendor:create", "vendor:update", "vendor:delete",
    "pipeline:view", "pipeline:create", "pipeline:move",
    "email:send", "email:config",
  ],

  // ── Recruiter ──────────────────────────────────────────────────────────────
  recruiter: [
    "candidate:view", "candidate:create", "candidate:update", "candidate:delete",
    "job:view", "job:create", "job:update", "job:delete",
    "client:view",
    "vendor:view",
    "pipeline:view", "pipeline:create", "pipeline:move",
    "email:send", "email:config",
  ],

  // ── Vendor Manager ─────────────────────────────────────────────────────────
  // Full CRUD on candidates, clients, and vendors. Read-only on jobs and pipeline.
  vendor_manager: [
    "candidate:view", "candidate:create", "candidate:update", "candidate:delete",
    "job:view",
    "client:view", "client:create", "client:update", "client:delete",
    "vendor:view", "vendor:create", "vendor:update", "vendor:delete",
    "pipeline:view", "pipeline:create",
  ],

  // ── Vendor User (Vendor) ───────────────────────────────────────────────────
  // Full CRUD on candidates — ONLY those linked to jobs assigned to their vendor.
  // Assignment check enforced in the controller layer for update/delete.
  vendor_user: [
    "job:view",
    "pipeline:view",
    "candidate:create", "candidate:update", "candidate:delete",
    "pipeline:create",
  ],

};
