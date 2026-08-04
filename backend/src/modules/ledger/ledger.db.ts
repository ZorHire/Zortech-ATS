import { Pool } from "pg";
import env from "../../config/env";

const ledgerPool = new Pool({
  connectionString: env.LEDGER_DATABASE_URL,
});

ledgerPool.on("error", (err) => {
  console.error("Ledger pg pool error:", err.message);
});

export async function initLedgerDb(): Promise<void> {
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
