// Test environment variables loading
require('dotenv').config();

console.log('=== Environment Variables Test ===');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`DB_HOST: ${process.env.DB_HOST}`);
console.log(`DB_PORT: ${process.env.DB_PORT}`);
console.log(`DB_NAME: ${process.env.DB_NAME}`);
console.log(`DB_USER: ${process.env.DB_USER}`);
console.log(`DB_SSL: ${process.env.DB_SSL}`);

// Test the database host conversion
const getDatabaseHost = () => {
  const host = process.env.DB_HOST || '127.0.0.1';
  // Convert localhost to IPv4 for cPanel compatibility
  return host === 'localhost' ? '127.0.0.1' : host;
};

console.log(`\n=== Database Host Conversion ===`);
console.log(`Original DB_HOST: ${process.env.DB_HOST}`);
console.log(`Converted host: ${getDatabaseHost()}`);

// Test database connection
const { Pool } = require('pg');

const dbConfig = {
  host: getDatabaseHost(),
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gfg_stable',
  user: process.env.DB_USER || 'gfg_user',
  password: process.env.DB_PASSWORD || 'gfg_password',
  ssl: false
};

console.log(`\n=== Database Configuration ===`);
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
  } else {
    console.log('✅ Database connection successful!');
    console.log('Current time:', res.rows[0].now);
  }
  
  pool.end();
});
