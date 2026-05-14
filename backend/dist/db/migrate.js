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
    // Collect numbered migration files from migrations/ directory, sorted by filename.
    const migrationsDir = path_1.default.resolve(__dirname, 'migrations');
    const migrationFiles = fs_1.default.existsSync(migrationsDir)
        ? fs_1.default.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort()
        : [];
    console.log('Starting database migration (additive only — no data loss)...');
    console.log(`Connecting to: ${env_1.default.DATABASE_URL.split('@')[1]}`);
    const client = await index_1.default.connect();
    try {
        await client.query('BEGIN');
        // Apply base schema (CREATE TABLE IF NOT EXISTS — safe for existing tables)
        await client.query(sql);
        // Additive column migrations — never drops data
        const columnMigrations = [
            `ALTER TABLE profiles
         ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL`,
            `ALTER TABLE jobs
         ADD COLUMN IF NOT EXISTS assigned_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL`,
            // Extended client fields
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_size text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS linkedin text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS headquarters_location text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS operating_locations text[] DEFAULT '{}'`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS alternate_contact text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS engagement_type text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS hiring_volume integer`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS active_requirements integer DEFAULT 0`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_priority text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS sla text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS working_hours text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_model text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR'`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS markup text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_terms text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_cycle text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_contact text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_start date`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_end date`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS msa_signed boolean DEFAULT false`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS nda_signed boolean DEFAULT false`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_skills text[] DEFAULT '{}'`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS typical_roles text[] DEFAULT '{}'`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS candidate_preference text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS hiring_strategy text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS interview_process text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS evaluation_criteria text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS positions_closed integer DEFAULT 0`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS avg_closure_time numeric`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS interview_ratio numeric`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS offer_acceptance_rate numeric`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_channel text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS update_frequency text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS auto_report boolean DEFAULT false`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS account_manager text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS delivery_lead text`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS recruiters text[] DEFAULT '{}'`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'`,
            `ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes text`,
            // Client stakeholders table
            `CREATE TABLE IF NOT EXISTS client_stakeholders (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name text NOT NULL,
        role text,
        email text,
        phone text,
        timezone text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
        ];
        for (const stmt of columnMigrations) {
            await client.query(stmt);
        }
        // Apply numbered migration files (idempotent — all use IF NOT EXISTS guards)
        for (const file of migrationFiles) {
            const filePath = path_1.default.join(migrationsDir, file);
            const migrationSql = fs_1.default.readFileSync(filePath, 'utf8');
            console.log(`  Applying ${file}...`);
            await client.query(migrationSql);
        }
        await client.query('COMMIT');
        console.log('Migration completed successfully — existing data preserved.');
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
