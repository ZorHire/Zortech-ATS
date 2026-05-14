/**
 * Platform database pool — explicit named export.
 *
 * The platform DB holds: tenants, subscriptions, tenant_memberships,
 * users, profiles, user_email_config, tenant_email_config.
 *
 * All existing controllers already import from "./index" which is the same pool.
 * This module provides a clearly-named alternative for new code that should be
 * explicit about which DB it is querying.
 *
 * Usage:
 *   import { platformPool, platformQuery } from "../db/platform";
 */
import pool from "./index";
import { query } from "./index";

export const platformPool = pool;
export const platformQuery = query;
export default pool;
