import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pool from './connection';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

interface Migration {
  id: number;
  name: string;
  sql: string;
}

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get executed migrations from database
    const { rows: executedMigrations } = await client.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executedMigrationNames = executedMigrations.map(row => row.name);

    // Find pending migrations
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrationNames.includes(file)
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations found');
      return;
    }

    logger.info(`Found ${pendingMigrations.length} pending migrations`);

    // Execute pending migrations
    for (const migrationFile of pendingMigrations) {
      logger.info(`Executing migration: ${migrationFile}`);
      
      const migrationPath = path.join(migrationsDir, migrationFile);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute migration
      await client.query(sql);
      
      // Record migration as executed
      await client.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [migrationFile]
      );
      
      logger.info(`✅ Migration ${migrationFile} completed successfully`);
    }

    logger.info('All migrations completed successfully');
    
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration process failed:', error);
      process.exit(1);
    });
}

export { runMigrations };
