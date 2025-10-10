# Production HTTP Mode Configuration

## Overview
This configuration allows you to run production build in HTTP mode (exactly like development) but using the built files from `dist/` folder.

## Environment Variables for cPanel

Set these environment variables in cPanel Node.js Selector:

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

# SSL Configuration - Disabled for HTTP mode
DISABLE_SSL=true

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-for-production
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com
```

## What This Configuration Does

1. **Runs production build** - Uses compiled files from `dist/` folder
2. **HTTP mode** - Behaves exactly like development (no SSL)
3. **Your configured port** - Runs on port 8762 (or whatever you set)
4. **cPanel handles HTTPS** - Server-level SSL redirects

## Testing Your Configuration

1. **Run debug script**:
   ```bash
   node debug-port.js
   ```

2. **Expected output**:
   ```
   NODE_ENV: production
   PORT: 8762
   DISABLE_SSL: true
   ✅ Will run HTTP server on port 8762
   ```

3. **Start your app**:
   ```bash
   npm start
   ```

4. **Check logs** - should show:
   ```
   Environment: production
   Port: 8762
   SSL Config Found: No
   Disable SSL: true
   🚀 GFG Stable Backend running on port 8762
   ```

## Benefits

- ✅ Production build performance
- ✅ HTTP mode (like development)
- ✅ Your configured port
- ✅ cPanel handles HTTPS
- ✅ No SSL certificate issues
- ✅ Easy debugging

## Commands

- **Build**: `npm run build`
- **Start**: `npm start`
- **Debug**: `node debug-port.js`
- **Test**: `curl http://yourdomain.com:8762/api/health`
