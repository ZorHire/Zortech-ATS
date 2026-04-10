import { Pool } from 'pg';
import env from '../config/env';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;