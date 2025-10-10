# IPv4 vs IPv6 Database Connection Fix

## The Problem
Your cPanel PostgreSQL is configured to only accept IPv4 connections (`127.0.0.1`), but your application is trying to connect using IPv6 (`::1`).

**Error**: `no pg_hba.conf entry for host "::1"`

## The Solution
Use IPv4 address instead of `localhost` for database connections.

## Updated Environment Variables

Set these in cPanel Node.js Selector:

```env
NODE_ENV=production
PORT=8762

# Database Configuration - Use IPv4
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=gfgstablethesuit_db
DB_USER=gfgstablethesuit_user
DB_PASSWORD=your_database_password
DB_SSL=false

# SSL Configuration
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

## Key Change
- **Before**: `DB_HOST=localhost` (resolves to IPv6 `::1`)
- **After**: `DB_HOST=127.0.0.1` (IPv4 address)

## Testing

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

## Expected Result
- ✅ Database connection successful
- ✅ Migrations run without errors
- ✅ Seeding completes successfully

## Why This Happens
- `localhost` can resolve to both IPv4 (`127.0.0.1`) and IPv6 (`::1`)
- cPanel PostgreSQL is configured to only accept IPv4 connections
- Using `127.0.0.1` explicitly forces IPv4 connection

This should fix your database connection issue!
