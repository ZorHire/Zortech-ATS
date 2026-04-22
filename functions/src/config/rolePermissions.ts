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
  // Read-only across the platform. No write access on any resource
  // (not in recruiterRoles, not in client/vendor write authorize lists).
  vendor_manager: [
    "candidate:view",
    "job:view",
    "client:view",
    "vendor:view",
    "pipeline:view",
  ],

  // ── Vendor User (Vendor) ───────────────────────────────────────────────────
  // Scoped to assigned jobs and their pipeline. Controlled at query level
  // via assigned_vendor_id filter in jobs.controller.ts.
  vendor_user: [
    "job:view",
    "pipeline:view",
  ],

};
