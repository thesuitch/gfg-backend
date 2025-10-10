// Test database connection script
require('dotenv').config();

const { Pool } = require('pg');

// Force IPv4 for cPanel PostgreSQL
const getDatabaseHost = () => {
  const host = process.env.DB_HOST || '127.0.0.1';
  // Convert localhost to IPv4 for cPanel compatibility
  return host === 'localhost' ? '127.0.0.1' : host;
};

const dbConfig = {
  host: getDatabaseHost(),
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gfg_stable',
  user: process.env.DB_USER || 'gfg_user',
  password: process.env.DB_PASSWORD || 'gfg_password',
  ssl: false
};

console.log('=== Database Connection Test ===');
console.log(`Host: ${dbConfig.host}`);
console.log(`Port: ${dbConfig.port}`);
console.log(`Database: ${dbConfig.database}`);
console.log(`User: ${dbConfig.user}`);
console.log(`SSL: ${dbConfig.ssl}`);

const pool = new Pool(dbConfig);

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('Error code:', err.code);
    console.error('Error detail:', err.detail);
  } else {
    console.log('✅ Database connection successful!');
    console.log('Current time:', res.rows[0].now);
  }
  
  pool.end();
});
