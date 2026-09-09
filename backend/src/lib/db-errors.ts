/**
 * Distinguishes "the database is unreachable/out of capacity" from a genuine
 * application bug. Both surface as a thrown error from pool.query(), but only
 * the former should become a 503 — a 500 tells the client to report a bug when
 * the real answer is "try again later".
 */

// Postgres SQLSTATE codes that mean the server cannot serve the query right now.
const UNAVAILABLE_SQLSTATES = new Set([
  "53000", // insufficient_resources — Neon compute-quota exhaustion lands here
  "53100", // disk_full
  "53200", // out_of_memory
  "53300", // too_many_connections
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now — server starting up
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08004", // sqlserver_rejected_establishment_of_sqlconnection
  "08006", // connection_failure
  "08007", // transaction_resolution_unknown
]);

// Socket-level failures raised by node before Postgres ever answers.
const UNAVAILABLE_SYSCALL_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "EAI_AGAIN",
]);

export const isDbUnavailable = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string") return false;
  return UNAVAILABLE_SQLSTATES.has(code) || UNAVAILABLE_SYSCALL_CODES.has(code);
};

export default isDbUnavailable;
