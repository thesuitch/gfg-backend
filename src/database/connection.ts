import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gfg_stable',
  user: process.env.DB_USER || 'gfg_user',
  password: process.env.DB_PASSWORD || 'gfg_password',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create a new pool instance
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test the connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database pool...');
  await pool.end();
  process.exit(0);
});

export default pool;
