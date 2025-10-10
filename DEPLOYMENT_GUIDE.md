# GFG Stable Backend - cPanel Deployment Guide

## PostgreSQL Database Setup

### Option 1: cPanel PostgreSQL (Recommended)
1. **Access cPanel** → **PostgreSQL Databases**
2. **Create Database**: `gfg_stable_prod`
3. **Create User**: `gfg_user` with strong password
4. **Assign User to Database** with ALL PRIVILEGES
5. **Note the connection details**:
   - Host: Usually `localhost` or provided by hosting
   - Port: `5432` (default)
   - Database: `gfg_stable_prod`
   - Username: `gfg_user`
   - Password: (your chosen password)

### Option 2: External PostgreSQL Service
- **Neon.tech** (Free tier available)
- **Supabase** (Free tier available)
- **Railway** (PostgreSQL addon)
- **Heroku Postgres** (Paid)

## Deployment Steps

### 1. Prepare Production Environment

Create `.env` file in backend root:
```env
NODE_ENV=production
PORT=3001

# Database Configuration
DB_HOST=your-cpanel-postgres-host
DB_PORT=5432
DB_NAME=gfg_stable_prod
DB_USER=gfg_user
DB_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-for-production
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# SSL Configuration (see SSL_SETUP_GUIDE.md for details)
SSL_KEY_PATH=/path/to/private.key
SSL_CERT_PATH=/path/to/certificate.crt
SSL_CA_PATH=/path/to/ca-bundle.crt
HTTP_PORT=80
```

### 2. Build the Application

```bash
cd backend
npm install
npm run build
```

### 3. Upload to cPanel

#### Method A: File Manager
1. **Access cPanel** → **File Manager**
2. **Navigate to** `public_html` or your domain folder
3. **Create folder**: `api` or `backend`
4. **Upload all files** from `backend/dist/` folder
5. **Upload** `package.json`, `package-lock.json`, and `.env`

#### Method B: Git (if available)
1. **Access cPanel** → **Git Version Control**
2. **Clone your repository**
3. **Navigate to backend folder**
4. **Run**: `npm install --production`
5. **Run**: `npm run build`

### 4. Install Dependencies

In cPanel Terminal or SSH:
```bash
cd /path/to/your/backend
npm install --production
```

### 5. Set Up Node.js Application

1. **Access cPanel** → **Node.js Selector**
2. **Create Application**:
   - **Application Root**: `/path/to/your/backend`
   - **Application URL**: `yourdomain.com/api` (or subdomain)
   - **Application Startup File**: `dist/index.js`
   - **Node.js Version**: Latest LTS (18.x or 20.x)

### 6. Environment Variables

In Node.js Selector:
1. **Go to Environment Variables**
2. **Add all variables** from your `.env` file
3. **Save configuration**

### 7. Database Migration

Run migrations to set up database tables:
```bash
npm run migrate
npm run seed  # Optional: seed initial data
```

### 8. Set Up SSL (Optional but Recommended)

1. **Follow SSL_SETUP_GUIDE.md** for detailed SSL configuration
2. **Upload SSL certificates** to `ssl/` directory
3. **Configure SSL environment variables** in Node.js Selector
4. **Test HTTPS** functionality

### 9. Start Application

1. **In Node.js Selector**: Click **"Start App"**
2. **Check logs** for any errors
3. **Test health endpoint**: `https://yourdomain.com/api/health`
4. **Test HTTP redirect**: `http://yourdomain.com/api/health` (should redirect to HTTPS)

## Important Notes

### Security Considerations
- **Change default passwords** and JWT secrets
- **Use HTTPS** in production
- **Update CORS origins** to your actual domain
- **Enable SSL** for database connections

### File Permissions
- **Uploads folder**: `755` permissions
- **Logs folder**: `755` permissions
- **Environment file**: `600` permissions (secure)

### Monitoring
- **Check application logs** regularly
- **Monitor database connections**
- **Set up uptime monitoring**

### Backup Strategy
- **Database backups**: Daily automated backups
- **File backups**: Regular backups of uploads and logs
- **Environment backup**: Keep `.env` file secure

## Troubleshooting

### Common Issues
1. **Port conflicts**: Ensure port 3001 is available
2. **Database connection**: Verify credentials and host
3. **File permissions**: Check folder permissions
4. **Memory limits**: Monitor Node.js memory usage
5. **CORS errors**: Update CORS origins for your domain

### Logs Location
- **Application logs**: Check cPanel Node.js logs
- **Error logs**: Check cPanel Error Logs
- **Database logs**: Check PostgreSQL logs in cPanel

## Testing Deployment

1. **Health Check**: `GET https://yourdomain.com/api/health`
2. **API Endpoints**: Test all API routes
3. **Database**: Verify data persistence
4. **File Uploads**: Test file upload functionality
5. **Authentication**: Test login/register flows

## Next Steps

1. **Set up SSL certificate** (Let's Encrypt via cPanel)
2. **Configure domain** to point to your API
3. **Set up monitoring** and alerts
4. **Implement backup strategy**
5. **Update frontend** to use production API URL
