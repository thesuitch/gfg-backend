# Database Connection Troubleshooting

## Error: "no pg_hba.conf entry for host, user, database, SSL off"

This error means your PostgreSQL server requires SSL connections, but your application is trying to connect without SSL.

## Solution 1: Enable SSL for Database (Recommended)

Set these environment variables in cPanel:

```env
NODE_ENV=production
PORT=8762
DB_HOST=localhost
DB_NAME=gfgstablethesuit_db
DB_USER=gfgstablethesuit_user
DB_PASSWORD=your_database_password
DB_SSL=true
DISABLE_SSL=true
CORS_ORIGIN=https://gfgstable.thesuitchstaging2.com
```

## Solution 2: Disable SSL for Database (Alternative)

If your cPanel allows non-SSL connections, set:

```env
NODE_ENV=production
PORT=8762
DB_HOST=localhost
DB_NAME=gfgstablethesuit_db
DB_USER=gfgstablethesuit_user
DB_PASSWORD=your_database_password
DB_SSL=false
DISABLE_SSL=true
CORS_ORIGIN=https://gfgstable.thesuitchstaging2.com
```

## Solution 3: Use IPv4 Instead of IPv6

The error shows `::1` which is IPv6. Try using IPv4:

```env
DB_HOST=127.0.0.1
```

Instead of:
```env
DB_HOST=localhost
```

## Testing Database Connection

1. **Test with SSL**:
   ```bash
   node -e "
   const { Pool } = require('pg');
   const pool = new Pool({
     host: 'localhost',
     port: 5432,
     database: 'gfgstablethesuit_db',
     user: 'gfgstablethesuit_user',
     password: 'your_password',
     ssl: { rejectUnauthorized: false }
   });
   pool.query('SELECT NOW()', (err, res) => {
     if (err) console.error('SSL Error:', err.message);
     else console.log('SSL Success:', res.rows[0]);
     pool.end();
   });
   "
   ```

2. **Test without SSL**:
   ```bash
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
     if (err) console.error('No SSL Error:', err.message);
     else console.log('No SSL Success:', res.rows[0]);
     pool.end();
   });
   "
   ```

## cPanel PostgreSQL Configuration

1. **Check PostgreSQL version** in cPanel
2. **Check SSL settings** in cPanel → PostgreSQL
3. **Verify database credentials**
4. **Check user permissions**

## Common Issues

### Issue: SSL Required
**Error**: `no pg_hba.conf entry for host, user, database, SSL off`
**Solution**: Set `DB_SSL=true`

### Issue: IPv6 vs IPv4
**Error**: `::1` in error message
**Solution**: Use `DB_HOST=127.0.0.1` instead of `localhost`

### Issue: Wrong Database Name
**Error**: `database "gfgstablethesuit_db" does not exist`
**Solution**: Check database name in cPanel

### Issue: Wrong User
**Error**: `role "gfgstablethesuit_user" does not exist`
**Solution**: Check username in cPanel

## Quick Fix Steps

1. **Set `DB_SSL=true`** in cPanel environment variables
2. **Restart your Node.js app**
3. **Test the connection**
4. **If still failing, try `DB_HOST=127.0.0.1`**

## Debug Commands

```bash
# Test database connection
npm run seed

# Check environment variables
node debug-port.js

# Test specific database connection
node -e "console.log(process.env.DB_HOST, process.env.DB_SSL)"
```

The database connection should work once you set `DB_SSL=true`!
