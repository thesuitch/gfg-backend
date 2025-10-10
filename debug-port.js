// Debug script to check port configuration
require('dotenv').config();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FORCE_SSL = process.env.FORCE_SSL || 'false';
const DISABLE_SSL = process.env.DISABLE_SSL || 'false';

console.log('=== Port Debug Information ===');
console.log(`NODE_ENV: ${NODE_ENV}`);
console.log(`PORT: ${PORT}`);
console.log(`FORCE_SSL: ${FORCE_SSL}`);
console.log(`DISABLE_SSL: ${DISABLE_SSL}`);

// Check SSL configuration
const fs = require('fs');
const path = require('path');

const keyPath = process.env.SSL_KEY_PATH || path.join(process.cwd(), 'ssl', 'private.key');
const certPath = process.env.SSL_CERT_PATH || path.join(process.cwd(), 'ssl', 'certificate.crt');

console.log('\n=== SSL Configuration ===');
console.log(`SSL_KEY_PATH: ${process.env.SSL_KEY_PATH || 'not set'}`);
console.log(`SSL_CERT_PATH: ${process.env.SSL_CERT_PATH || 'not set'}`);
console.log(`Key file exists: ${fs.existsSync(keyPath)}`);
console.log(`Cert file exists: ${fs.existsSync(certPath)}`);

const sslConfig = fs.existsSync(keyPath) && fs.existsSync(certPath);
const isProduction = NODE_ENV === 'production';
const forceSSL = FORCE_SSL === 'true';
const disableSSL = DISABLE_SSL === 'true';

console.log('\n=== Server Mode Decision ===');
console.log(`SSL Config Found: ${sslConfig}`);
console.log(`Is Production: ${isProduction}`);
console.log(`Force SSL: ${forceSSL}`);
console.log(`Disable SSL: ${disableSSL}`);

if (sslConfig && (isProduction || forceSSL) && !disableSSL) {
  console.log(`✅ Will run HTTPS server on port ${PORT}`);
  console.log(`ℹ️ HTTP redirect server will be disabled (cPanel handles redirects)`);
} else {
  console.log(`✅ Will run HTTP server on port ${PORT}`);
}

console.log('\n=== To Run Production in HTTP Mode (Like Development) ===');
console.log('1. Set NODE_ENV=production');
console.log('2. Set DISABLE_SSL=true');
console.log('3. Set PORT=8762 (or your desired port)');
console.log('4. This will run production build in HTTP mode on your configured port');
