# Staging Environment Configuration

## Your Current Setup
- **Frontend**: `https://gfgstable.thesuitchstaging2.com`
- **Backend**: `https://gfgstable.thesuitchstaging2.com:8762`

## CORS Issue Solution

The CORS error occurs because:
1. Frontend is on port 443 (default HTTPS)
2. Backend is on port 8762
3. Different ports = cross-origin request

## Environment Variables for Staging

Set these in cPanel Node.js Selector:

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

# SSL Configuration
DISABLE_SSL=true

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration - IMPORTANT
CORS_ORIGIN=https://gfgstable.thesuitchstaging2.com
```

## Frontend Configuration

Update your frontend API base URL to:

```javascript
// In your frontend environment or config
const API_BASE_URL = 'https://gfgstable.thesuitchstaging2.com:8762/api';
```

## Alternative Solutions

### Option 1: Use Subdomain (Recommended)
- **Frontend**: `https://gfgstable.thesuitchstaging2.com`
- **Backend**: `https://api.gfgstable.thesuitchstaging2.com`
- **Port**: 443 (default HTTPS)

### Option 2: Use Same Port
- **Frontend**: `https://gfgstable.thesuitchstaging2.com`
- **Backend**: `https://gfgstable.thesuitchstaging2.com/api`
- **Port**: 443 (default HTTPS)

### Option 3: Keep Current Setup
- **Frontend**: `https://gfgstable.thesuitchstaging2.com`
- **Backend**: `https://gfgstable.thesuitchstaging2.com:8762`
- **CORS**: Must be properly configured (see above)

## Testing CORS

1. **Check CORS headers**:
   ```bash
   curl -H "Origin: https://gfgstable.thesuitchstaging2.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://gfgstable.thesuitchstaging2.com:8762/api/auth/login
   ```

2. **Expected response**:
   ```
   Access-Control-Allow-Origin: https://gfgstable.thesuitchstaging2.com
   Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
   Access-Control-Allow-Headers: Content-Type
   Access-Control-Allow-Credentials: true
   ```

## Quick Fix

1. **Set CORS_ORIGIN** in cPanel environment variables
2. **Restart your Node.js app**
3. **Test the login endpoint**

The CORS error should be resolved!
