/**
 * Run only transaction categories seed (idempotent).
 * Use: npm run seed:categories
 */
import dotenv from 'dotenv';
import pool from './connection';
import { logger } from '../utils/logger';
import { seedTransactionCategories } from './seedTransactionCategories';

dotenv.config();

async function run() {
  const client = await pool.connect();
  try {
    await seedTransactionCategories(client);
    logger.info('🎉 Categories seed completed');
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch((e) => {
  logger.error(e);
  process.exit(1);
});
