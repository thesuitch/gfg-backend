import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pool from './connection';
import { logger } from '../utils/logger';

dotenv.config();

interface ExecutedMigration {
  name: string;
  executed_at: Date;
}

function listMigrationFiles(): string[] {
  const migrationsDir = path.join(__dirname, 'migrations');
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

function formatTimestamp(value: Date | undefined): string {
  if (!value) return '—';
  return value.toISOString().replace('T', ' ').slice(0, 19);
}

export async function getMigrationStatus(): Promise<{
  migrationFiles: string[];
  executed: ExecutedMigration[];
  pending: string[];
}> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationFiles = listMigrationFiles();
    const { rows } = await client.query<ExecutedMigration>(
      'SELECT name, executed_at FROM migrations ORDER BY id'
    );

    const executedNames = new Set(rows.map((r) => r.name));
    const pending = migrationFiles.filter((file) => !executedNames.has(file));

    return { migrationFiles, executed: rows, pending };
  } finally {
    client.release();
  }
}

export async function printMigrationStatus(): Promise<void> {
  const host = process.env.DB_HOST === 'localhost' ? '127.0.0.1' : process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'gfg_stable';

  const { migrationFiles, executed, pending } = await getMigrationStatus();
  const executedByName = new Map(executed.map((r) => [r.name, r.executed_at]));

  console.log('');
  console.log('GFG Stable — Migration Status');
  console.log(`Database: ${database} @ ${host}:${port}`);
  console.log('');

  const statusCol = 10;
  const nameCol = 54;
  console.log(
    `${'Status'.padEnd(statusCol)}${'Migration'.padEnd(nameCol)}Executed At`
  );
  console.log(`${'-'.repeat(statusCol)}${'-'.repeat(nameCol)}${'-'.repeat(19)}`);

  for (const file of migrationFiles) {
    const ran = executedByName.has(file);
    const statusLabel = ran ? 'applied' : 'pending';
    const marker = ran ? '✓' : '○';
    const executedAt = formatTimestamp(executedByName.get(file));
    console.log(
      `${(`${marker} ${statusLabel}`).padEnd(statusCol)}${file.padEnd(nameCol)}${executedAt}`
    );
  }

  console.log('');
  console.log(
    `Summary: ${executed.length} applied, ${pending.length} pending, ${migrationFiles.length} total`
  );

  if (pending.length > 0) {
    console.log('');
    console.log('Run pending migrations: npm run migrate');
  }
  console.log('');
}

if (require.main === module) {
  printMigrationStatus()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration status check failed:', error);
      process.exit(1);
    });
}
