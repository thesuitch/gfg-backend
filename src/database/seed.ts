import dotenv from 'dotenv';
import pool from './connection';
import { hashPassword } from '../utils/jwt';
import { logger } from '../utils/logger';
import { seedTransactionCategories } from './seedTransactionCategories';

// Load environment variables
dotenv.config();

// Log database configuration for debugging
logger.info(`Seed script - DB_HOST: ${process.env.DB_HOST}`);
logger.info(`Seed script - NODE_ENV: ${process.env.NODE_ENV}`);

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    logger.info('🌱 Starting database seeding...');

    // Seed transaction categories (idempotent; safe to run every time)
    await seedTransactionCategories(client);

    // Check if admin user already exists
    const existingAdmin = await client.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@gfgstable.com']
    );

    if (existingAdmin.rows.length > 0) {
      logger.info('✅ Admin user already exists, skipping seed');
      return;
    }

    // Get admin role ID
    const roleResult = await client.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    if (roleResult.rows.length === 0) {
      throw new Error('Admin role not found. Please run migrations first.');
    }

    const adminRoleId = roleResult.rows[0].id;

    // Create admin user
    const adminPassword = await hashPassword('admin123');
    
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'admin@gfgstable.com',
      adminPassword,
      'Admin',
      'User',
      adminRoleId,
      true
    ]);

    logger.info('✅ Admin user created successfully');
    logger.info('📧 Email: admin@gfgstable.com');
    logger.info('🔑 Password: admin123');
    logger.info('⚠️  Remember to change the password in production!');

  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('🎉 Database seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Database seeding failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };
