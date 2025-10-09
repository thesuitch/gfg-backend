import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(__dirname, 'migrations');

// Ensure migrations directory exists
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// Get migration name from command line arguments
const migrationName = process.argv[2];

if (!migrationName) {
  console.error('Usage: npm run migrate:create <migration-name>');
  console.error('Example: npm run migrate:create create_users_table');
  process.exit(1);
}

// Create timestamp for migration
const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
const fileName = `${timestamp}_${migrationName}.sql`;
const filePath = path.join(migrationsDir, fileName);

// Migration template
const migrationTemplate = `-- Migration: ${migrationName}
-- Created: ${new Date().toISOString()}

-- Add your SQL here
-- Example:
-- CREATE TABLE users (
--   id SERIAL PRIMARY KEY,
--   email VARCHAR(255) UNIQUE NOT NULL,
--   password_hash VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Don't forget to add a corresponding rollback in the down section below

-- Down migration (rollback)
-- DROP TABLE IF EXISTS users;
`;

// Write migration file
fs.writeFileSync(filePath, migrationTemplate);

console.log(`✅ Migration file created: ${fileName}`);
console.log(`📁 Location: ${filePath}`);
console.log('\n📝 Edit the file to add your SQL statements');
console.log('🚀 Run migrations with: npm run migrate');
