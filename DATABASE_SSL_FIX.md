# Database SSL Fix - cPanel PostgreSQL

## Current Issue
Your cPanel PostgreSQL server requires SSL connections, but your application was trying to connect without SSL.

**Error**: `no pg_hba.conf entry for host "127.0.0.1", user "gfgstablethesuit_user", database "gfgstablethesuit_db", SSL off`

## Solution: Enable SSL for Database

### Updated Environment Variables for cPanel

Set these in cPanel Node.js Selector:

```env
NODE_ENV=production
PORT=8762

# Database Configuration - Enable SSL
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=gfgstablethesuit_db
DB_USER=gfgstablethesuit_user
DB_PASSWORD=your_database_password
DB_SSL=true

# SSL Configuration - Disabled for HTTP mode
DISABLE_SSL=true

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=https://gfgstable.thesuitchstaging2.com
```

## Key Changes Made

1. **`DB_SSL=true`** - Enables SSL for database connection
2. **`DISABLE_SSL=true`** - Disables SSL for the application server (HTTP mode)
3. **Database SSL** - Uses `{ rejectUnauthorized: false }` for cPanel compatibility

## What This Means

- **Database Connection**: Uses SSL (required by cPanel PostgreSQL)
- **Application Server**: Runs in HTTP mode (cPanel handles HTTPS redirect)
- **Best of Both**: Secure database + simple HTTP server

## Testing Steps

1. **Update environment variables** in cPanel
2. **Restart Node.js app** in cPanel
3. **Test migration**:
   ```bash
   npm run migrate
   ```
4. **Test seeding**:
   ```bash
   npm run seed
   ```

## Expected Results

- ✅ Database connection with SSL
- ✅ Migration runs successfully
- ✅ Seeding completes without errors
- ✅ Application runs on port 8762 in HTTP mode

## Debug Commands

```bash
# Test database connection with SSL
node test-db-connection.js

# Test environment variables
node test-env.js

# Check SSL configuration
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'gfgstablethesuit_db',
  user: 'gfgstablethesuit_user',
  password: 'your_password',
  ssl: { rejectUnauthorized: false }
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('Error:', err.message);
  else console.log('Success:', res.rows[0]);
  pool.end();
});
"
```

## Why This Works

- **cPanel PostgreSQL** requires SSL connections
- **Application server** can run in HTTP mode
- **cPanel handles HTTPS** redirects at server level
- **Database is secure** with SSL encryption

This configuration should resolve your database connection issues!
