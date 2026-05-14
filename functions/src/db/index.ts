import { Pool } from "pg";
import env from "../config/env";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Verify SSL cert in production; allow self-signed only in local dev.
  ssl: env.NODE_ENV === "development" ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
  max: 2,                    // serverless: each instance handles 1 req at a time
  idleTimeoutMillis: 600000, // keep connection alive for 10 min (warm instance reuse)
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("Unexpected pg pool error:", err.message);
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
