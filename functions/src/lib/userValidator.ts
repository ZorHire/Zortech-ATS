/**
 * Application-layer UUID validation for cross-DB foreign key columns.
 *
 * Because `users` lives in the platform DB and ATS tables live in isolated
 * tenant DBs, there are no database-level FK constraints for columns like
 * `assigned_recruiter_id`, `created_by`, or `changed_by`.  This module
 * enforces referential integrity at the application layer instead.
 *
 * A 5-minute in-memory TTL cache avoids a platform DB round-trip on every
 * write while still catching recently-deleted users within a reasonable window.
 */

import { platformPool } from "../db/platform";

// userId → cache expiry timestamp (ms since epoch)
const validUserCache = new Map<string, number>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns true if the given UUID exists in the platform users table.
 * Result is cached for CACHE_TTL_MS to reduce platform DB round-trips.
 */
export async function validateUserExists(userId: string): Promise<boolean> {
  const now = Date.now();
  const expiry = validUserCache.get(userId);
  if (expiry !== undefined && expiry > now) return true;

  const result = await platformPool.query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1) AS exists",
    [userId],
  );

  const exists = result.rows[0].exists;
  if (exists) {
    validUserCache.set(userId, now + CACHE_TTL_MS);
  }
  return exists;
}

/**
 * Validate multiple UUIDs in a single query.
 * Returns the set of IDs that do NOT exist in the users table.
 */
export async function validateUsersExist(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];

  const now = Date.now();
  const uncached = userIds.filter((id) => {
    const expiry = validUserCache.get(id);
    return expiry === undefined || expiry <= now;
  });

  if (uncached.length > 0) {
    const result = await platformPool.query<{ id: string }>(
      "SELECT id FROM users WHERE id = ANY($1::uuid[])",
      [uncached],
    );
    const found = new Set(result.rows.map((r) => r.id));
    for (const id of uncached) {
      if (found.has(id)) {
        validUserCache.set(id, now + CACHE_TTL_MS);
      }
    }
  }

  return userIds.filter((id) => {
    const expiry = validUserCache.get(id);
    return expiry === undefined || expiry <= Date.now();
  });
}

/**
 * Remove a user from the validation cache (e.g. after deletion).
 */
export function invalidateUserCache(userId: string): void {
  validUserCache.delete(userId);
}
