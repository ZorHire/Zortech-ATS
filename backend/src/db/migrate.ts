import fs from 'fs';
import path from 'path';
import pool from './index';
import env from '../config/env';

const migrate = async () => {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Starting database migration (DROP and RECREATE)...');
  console.log(`Connecting to: ${env.DATABASE_URL.split('@')[1]}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Drop all tables in public schema to ensure a clean slate for refactor
    const dropTablesSql = `
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `;
    await client.query(dropTablesSql);
    console.log('Existing tables dropped.');

    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();