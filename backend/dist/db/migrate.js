"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = __importDefault(require("./index"));
const env_1 = __importDefault(require("../config/env"));
const migrate = async () => {
    const schemaPath = path_1.default.resolve(__dirname, 'schema.sql');
    const sql = fs_1.default.readFileSync(schemaPath, 'utf8');
    console.log('Starting database migration (DROP and RECREATE)...');
    console.log(`Connecting to: ${env_1.default.DATABASE_URL.split('@')[1]}`);
    const client = await index_1.default.connect();
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
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await index_1.default.end();
    }
};
migrate();
