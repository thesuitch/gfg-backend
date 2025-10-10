// Simple port test script for debugging
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('=== Port Configuration Test ===');
console.log(`NODE_ENV: ${NODE_ENV}`);
console.log(`PORT: ${PORT}`);
console.log(`Process PORT: ${process.env.PORT}`);

// Test SSL configuration
const fs = require('fs');
const path = require('path');

const keyPath = process.env.SSL_KEY_PATH || path.join(process.cwd(), 'ssl', 'private.key');
const certPath = process.env.SSL_CERT_PATH || path.join(process.cwd(), 'ssl', 'certificate.crt');

console.log('\n=== SSL Configuration Test ===');
console.log(`SSL_KEY_PATH: ${process.env.SSL_KEY_PATH || 'not set'}`);
console.log(`SSL_CERT_PATH: ${process.env.SSL_CERT_PATH || 'not set'}`);
console.log(`Key file exists: ${fs.existsSync(keyPath)}`);
console.log(`Cert file exists: ${fs.existsSync(certPath)}`);

if (NODE_ENV === 'production') {
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('✅ SSL certificates found - will run HTTPS on port', PORT);
  } else {
    console.log('⚠️ SSL certificates not found - will run HTTP on port', PORT);
  }
} else {
  console.log('ℹ️ Development mode - will run HTTP on port', PORT);
}

console.log('\n=== Expected Behavior ===');
if (NODE_ENV === 'production' && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('HTTPS server will start on port:', PORT);
  console.log('HTTP redirect server will be disabled (cPanel handles redirects)');
} else {
  console.log('HTTP server will start on port:', PORT);
}
