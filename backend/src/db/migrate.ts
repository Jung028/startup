import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const db = new Pool({ connectionString: config.db.url });

async function migrate() {
  console.log('🔄 Running database migrations...');

  // Create migrations tracking table
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Load and run the base schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const { rows: applied } = await db.query(
    "SELECT version FROM schema_migrations WHERE version = '001_initial_schema'"
  );

  if (applied.length === 0) {
    console.log('  Applying migration: 001_initial_schema');
    await db.query(schema);
    await db.query(
      "INSERT INTO schema_migrations (version) VALUES ('001_initial_schema')"
    );
    console.log('  ✅ 001_initial_schema applied');
  } else {
    console.log('  ✅ 001_initial_schema already applied');
  }

  // Future migrations can be added here as:
  // await applyMigration(db, '002_add_feature', `ALTER TABLE ...`);

  await db.end();
  console.log('\n✅ All migrations applied successfully');
}

async function applyMigration(pool: Pool, version: string, sql: string) {
  const { rows } = await pool.query(
    'SELECT version FROM schema_migrations WHERE version = $1', [version]
  );
  if (rows.length > 0) {
    console.log(`  ✅ ${version} already applied`);
    return;
  }
  console.log(`  Applying migration: ${version}`);
  await pool.query(sql);
  await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
  console.log(`  ✅ ${version} applied`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
