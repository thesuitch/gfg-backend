import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

// SSL configuration for database
const getSSLConfig = () => {
  // If DB_SSL is explicitly set to false, disable SSL
  if (process.env.DB_SSL === 'false') {
    return false;
  }
  
  // If DB_SSL is explicitly set to true, enable SSL
  if (process.env.DB_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  
  // Default: No SSL for cPanel PostgreSQL
  return false;
};

// Force IPv4 for all database connections to avoid IPv6 issues
const getDatabaseHost = () => {
  const host = process.env.DB_HOST || 'localhost';
  // Convert localhost to IPv4 to avoid IPv6 resolution issues
  return host === 'localhost' ? '127.0.0.1' : host;
};

const dbConfig: PoolConfig = {
  host: getDatabaseHost(), // Force IPv4 for cPanel
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gfg_stable',
  user: process.env.DB_USER || 'gfg_user',
  password: process.env.DB_PASSWORD || 'gfg_password',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl: getSSLConfig()
};

// Log database configuration
logger.info(`Database configuration: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
logger.info(`Database user: ${dbConfig.user}`);
logger.info(`SSL enabled: ${dbConfig.ssl ? 'Yes' : 'No'}`);
logger.info(`Environment: ${process.env.NODE_ENV}`);
logger.info(`DB_HOST env: ${process.env.DB_HOST}`);

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
