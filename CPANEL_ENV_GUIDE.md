# cPanel Environment Configuration Guide

## Port Configuration Issue

If your app is running on port 80 instead of your configured port (8762) in production, here's how to fix it:

## Solution 1: Disable SSL (Recommended for cPanel)

Most cPanel hosting providers handle SSL at the server level, so you don't need to configure SSL in your Node.js app.

### Environment Variables for cPanel:

```env
NODE_ENV=production
PORT=8762

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gfg_stable_prod
DB_USER=your_database_user
DB_PASSWORD=your_secure_password
DB_SSL=false

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-for-production
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# DO NOT set SSL variables - let cPanel handle SSL
# SSL_KEY_PATH=
# SSL_CERT_PATH=
# SSL_CA_PATH=
```

## Solution 2: Use cPanel SSL (If you want app-level SSL)

If you want to handle SSL in your Node.js app:

1. **Get SSL certificates from cPanel**:
   - Go to cPanel → SSL/TLS
   - Generate Let's Encrypt certificate
   - Note the certificate paths

2. **Set environment variables**:
```env
NODE_ENV=production
PORT=8762

# SSL Configuration
SSL_KEY_PATH=/home/username/ssl/yourdomain.com.key
SSL_CERT_PATH=/home/username/ssl/yourdomain.com.crt
SSL_CA_PATH=/home/username/ssl/yourdomain.com.ca-bundle

# Other variables...
```

## Solution 3: Force HTTP Mode

If you want to run in HTTP mode but on your custom port:

```env
NODE_ENV=development
PORT=8762

# This will run in HTTP mode on port 8762
# cPanel will handle HTTPS redirect at server level
```

## cPanel Node.js Selector Configuration

1. **Application Root**: `/home/username/yourdomain.com/backend`
2. **Application URL**: `yourdomain.com/api` (or subdomain)
3. **Application Startup File**: `dist/index.js`
4. **Node.js Version**: Latest LTS (18.x or 20.x)

## Environment Variables in cPanel

In Node.js Selector → Environment Variables, add:

```
NODE_ENV=production
PORT=8762
DB_HOST=localhost
DB_NAME=gfg_stable_prod
DB_USER=your_database_user
DB_PASSWORD=your_secure_password
DB_SSL=false
DISABLE_SSL=true
JWT_SECRET=your-super-secure-jwt-secret
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://yourdomain.com
```

**Important**: Set `DISABLE_SSL=true` to run production in HTTP mode (like development).

## Testing Your Configuration

1. **Check logs** in cPanel Node.js Selector
2. **Test your endpoint**: `https://yourdomain.com/api/health`
3. **Verify port**: Look for "running on port 8762" in logs

## Common Issues

### Issue: App runs on port 80 instead of 8762
**Cause**: SSL configuration is trying to start HTTP redirect server
**Solution**: Don't set SSL environment variables, let cPanel handle SSL

### Issue: App won't start
**Cause**: Missing environment variables or database connection
**Solution**: Check all required environment variables are set

### Issue: SSL errors
**Cause**: SSL certificates not found or invalid
**Solution**: Use Solution 1 (disable app-level SSL) or fix certificate paths

## Recommended cPanel Setup

For most cPanel hosting, use this configuration:

```env
NODE_ENV=production
PORT=8762
DB_HOST=localhost
DB_NAME=gfg_stable_prod
DB_USER=your_database_user
DB_PASSWORD=your_secure_password
DB_SSL=false
JWT_SECRET=your-super-secure-jwt-secret
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://yourdomain.com
```

**Important Notes:**
- **Don't set any SSL_* variables** - let cPanel handle SSL at the server level
- **Set DB_SSL=false** - most cPanel PostgreSQL instances don't support SSL
- **Use localhost for DB_HOST** - cPanel databases are typically local
