# Quick Fix Guide - Database Connection

## Current Issue
Your cPanel environment still has `DB_HOST=localhost` which resolves to IPv6 (`::1`), but cPanel PostgreSQL only accepts IPv4 (`127.0.0.1`).

## Solution 1: Update cPanel Environment Variables (Recommended)

In cPanel Node.js Selector → Environment Variables, change:

**From:**
```
DB_HOST=localhost
```

**To:**
```
DB_HOST=127.0.0.1
```

## Solution 2: Use the Automatic Fix (Already Applied)

I've updated the code to automatically convert `localhost` to `127.0.0.1`. 

**Test the fix:**
```bash
node test-db-connection.js
```

## Solution 3: Complete Environment Variables

Set these in cPanel Node.js Selector:

```env
NODE_ENV=production
PORT=8762
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=gfgstablethesuit_db
DB_USER=gfgstablethesuit_user
DB_PASSWORD=your_database_password
DB_SSL=false
DISABLE_SSL=true
CORS_ORIGIN=https://gfgstable.thesuitchstaging2.com
JWT_SECRET=your-super-secure-jwt-secret
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Testing Steps

1. **Test database connection:**
   ```bash
   node test-db-connection.js
   ```

2. **Expected output:**
   ```
   Host: 127.0.0.1
   Port: 5432
   Database: gfgstablethesuit_db
   User: gfgstablethesuit_user
   SSL: false
   ✅ Database connection successful!
   ```

3. **Test migration:**
   ```bash
   npm run migrate
   ```

4. **Test seeding:**
   ```bash
   npm run seed
   ```

## If Still Failing

1. **Check cPanel PostgreSQL:**
   - Database exists: `gfgstablethesuit_db`
   - User exists: `gfgstablethesuit_user`
   - User has ALL PRIVILEGES on database

2. **Check environment variables:**
   ```bash
   node -e "console.log('DB_HOST:', process.env.DB_HOST)"
   ```

3. **Try different host formats:**
   - `127.0.0.1`
   - `localhost`
   - Your server's actual IP

The automatic fix should work, but updating the environment variable is the cleanest solution!
