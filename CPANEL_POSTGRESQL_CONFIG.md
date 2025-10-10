# cPanel PostgreSQL Configuration

## Your Current Setup
- **Frontend**: `https://gfgstable.thesuitchstaging2.com`
- **Backend**: `https://gfgstable.thesuitchstaging2.com:8762`
- **Database**: cPanel PostgreSQL on port 5432
- **Issue**: "The server does not support SSL connections"

## Solution: Disable SSL for cPanel PostgreSQL

Most cPanel PostgreSQL instances don't support SSL connections. Use this configuration:

### Environment Variables for cPanel

Set these in cPanel Node.js Selector:

```env
NODE_ENV=production
PORT=8762

# Database Configuration - cPanel PostgreSQL
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

## Key Points

1. **`DB_SSL=true`** - Disables SSL for database connection
2. **`DB_HOST=127.0.0.1`** - Uses localhost for cPanel database
3. **`DB_PORT=5432`** - Standard PostgreSQL port
4. **`DISABLE_SSL=true`** - Disables SSL for the application server

## Testing Database Connection

1. **Test with current config**:
   ```bash
   npm run seed
   ```

2. **Expected result**: Database connection successful without SSL

3. **If still failing**, check:
   - Database name is correct
   - Username is correct
   - Password is correct
   - Database exists in cPanel

## cPanel Database Setup

1. **Go to cPanel** → **PostgreSQL Databases**
2. **Create Database**: `gfgstablethesuit_db`
3. **Create User**: `gfgstablethesuit_user`
4. **Assign User to Database** with ALL PRIVILEGES
5. **Note the credentials** for environment variables

## Common cPanel PostgreSQL Issues

### Issue: SSL Not Supported
**Error**: "The server does not support SSL connections"
**Solution**: Set `DB_SSL=true`

### Issue: Database Not Found
**Error**: "database does not exist"
**Solution**: Check database name in cPanel

### Issue: User Not Found
**Error**: "role does not exist"
**Solution**: Check username in cPanel

### Issue: Permission Denied
**Error**: "permission denied for table"
**Solution**: Grant ALL PRIVILEGES to user

## Quick Fix Steps

1. **Set `DB_SSL=true`** in cPanel environment variables
2. **Verify database credentials** in cPanel
3. **Restart Node.js app** in cPanel
4. **Test with**: `npm run seed`

## Debug Commands

```bash
# Test database connection
npm run seed

# Check environment variables
node debug-port.js

# Test specific database connection
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gfgstablethesuit_db',
  user: 'gfgstablethesuit_user',
  password: 'your_password',
  ssl: false
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('Error:', err.message);
  else console.log('Success:', res.rows[0]);
  pool.end();
});
"
```

This configuration should work with cPanel PostgreSQL!
