import { Pool } from "pg";
import env from "../../config/env";

let ledgerPool: Pool;

if (!env.LEDGER_DATABASE_URL) {
  console.warn("LEDGER_DATABASE_URL is not set — ledger module is disabled");
  // Create a non-functional pool so imports don't break; all queries will fail gracefully
  // and ledger.routes.ts catches those errors and returns 503.
  ledgerPool = new Pool({ connectionString: "postgresql://disabled" });
} else {
  ledgerPool = new Pool({
    connectionString: env.LEDGER_DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

ledgerPool.on("error", (err) => {
  console.error("Ledger pg pool error:", err.message);
});

export async function initLedgerDb(): Promise<void> {
  if (!env.LEDGER_DATABASE_URL) {
    console.warn("Ledger DB init skipped — LEDGER_DATABASE_URL not configured");
    return;
  }
  await ledgerPool.query(`
    CREATE TABLE IF NOT EXISTS ledger_kv (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("Ledger DB ready");
}

export default ledgerPool;
