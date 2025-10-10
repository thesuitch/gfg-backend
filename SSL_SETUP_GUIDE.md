# SSL Setup Guide for GFG Stable Backend

## Overview

This guide covers setting up SSL/HTTPS for your GFG Stable backend. The application now supports both HTTP and HTTPS modes, with automatic HTTP to HTTPS redirection in production.

## SSL Configuration Options

### Option 1: cPanel SSL (Recommended)

Most cPanel hosting providers offer free SSL certificates through Let's Encrypt:

1. **Access cPanel** → **SSL/TLS**
2. **Generate SSL Certificate**:
   - Select your domain
   - Choose "Let's Encrypt" (free)
   - Click "Generate"
3. **Force HTTPS Redirect**:
   - Go to **Force HTTPS Redirect**
   - Enable redirect from HTTP to HTTPS
4. **Note the certificate paths** (usually):
   - Private Key: `/home/username/ssl/yourdomain.com.key`
   - Certificate: `/home/username/ssl/yourdomain.com.crt`
   - CA Bundle: `/home/username/ssl/yourdomain.com.ca-bundle`

### Option 2: Let's Encrypt (Manual)

If you have SSH access or want to manage certificates manually:

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --webroot -w /path/to/your/website -d yourdomain.com

# Certificates will be stored in:
# /etc/letsencrypt/live/yourdomain.com/
```

### Option 3: Commercial SSL Certificate

If you have a commercial SSL certificate:

1. **Upload certificate files** to your server
2. **Note the file paths** for configuration
3. **Update environment variables** accordingly

## Environment Variables

Add these SSL-related variables to your `.env` file:

```env
# SSL Configuration
SSL_KEY_PATH=/path/to/private.key
SSL_CERT_PATH=/path/to/certificate.crt
SSL_CA_PATH=/path/to/ca-bundle.crt

# Alternative: Direct certificate content (for containerized deployments)
SSL_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
SSL_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
SSL_CA="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"

# HTTP Redirect Port (optional)
HTTP_PORT=80
```

## File Structure

Create an `ssl` directory in your backend folder:

```
backend/
├── ssl/
│   ├── private.key      # Private key file
│   ├── certificate.crt  # Certificate file
│   └── ca-bundle.crt    # CA bundle file (optional)
├── src/
└── ...
```

## cPanel Specific Setup

### 1. Upload Certificate Files

1. **Access cPanel** → **File Manager**
2. **Navigate to** your backend directory
3. **Create folder**: `ssl`
4. **Upload certificate files**:
   - `private.key` (from cPanel SSL/TLS)
   - `certificate.crt` (from cPanel SSL/TLS)
   - `ca-bundle.crt` (from cPanel SSL/TLS)

### 2. Set File Permissions

```bash
# Set secure permissions for SSL files
chmod 600 ssl/private.key
chmod 644 ssl/certificate.crt
chmod 644 ssl/ca-bundle.crt
```

### 3. Update Environment Variables

In cPanel Node.js Selector:
1. **Go to Environment Variables**
2. **Add SSL variables**:
   - `SSL_KEY_PATH`: `/home/username/yourdomain.com/backend/ssl/private.key`
   - `SSL_CERT_PATH`: `/home/username/yourdomain.com/backend/ssl/certificate.crt`
   - `SSL_CA_PATH`: `/home/username/yourdomain.com/backend/ssl/ca-bundle.crt`

## Testing SSL Configuration

### 1. Health Check

```bash
# Test HTTPS endpoint
curl -k https://yourdomain.com/api/health

# Test HTTP redirect
curl -I http://yourdomain.com/api/health
# Should return 301/302 redirect to HTTPS
```

### 2. SSL Certificate Validation

```bash
# Check certificate details
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Test SSL Labs (online)
# Visit: https://www.ssllabs.com/ssltest/
```

### 3. Browser Testing

1. **Visit**: `https://yourdomain.com/api/health`
2. **Check**: Green lock icon in browser
3. **Verify**: No mixed content warnings

## Troubleshooting

### Common Issues

1. **Certificate not found**:
   - Check file paths in environment variables
   - Verify file permissions (600 for private key)
   - Ensure files exist and are readable

2. **Permission denied**:
   ```bash
   chmod 600 ssl/private.key
   chown youruser:yourgroup ssl/*
   ```

3. **Certificate expired**:
   - Renew Let's Encrypt certificate
   - Update certificate files
   - Restart application

4. **Mixed content errors**:
   - Ensure all resources use HTTPS
   - Update CORS origins to use HTTPS
   - Check frontend API calls

### Logs to Check

1. **Application logs**: Check for SSL-related errors
2. **cPanel Error Logs**: Look for SSL/TLS errors
3. **Browser Console**: Check for mixed content warnings

## Security Best Practices

1. **File Permissions**:
   - Private key: `600` (owner read/write only)
   - Certificates: `644` (readable by all)

2. **Environment Variables**:
   - Never commit SSL keys to version control
   - Use environment variables for sensitive data
   - Rotate certificates regularly

3. **HTTPS Enforcement**:
   - Always redirect HTTP to HTTPS in production
   - Use HSTS headers (handled by Helmet.js)
   - Validate certificate chain

## Certificate Renewal

### Let's Encrypt (Auto-renewal)

Most cPanel providers handle renewal automatically. For manual renewal:

```bash
# Renew certificate
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

### Manual Renewal

1. **Download new certificate** from your provider
2. **Replace old files** in ssl directory
3. **Restart application** to load new certificate
4. **Test HTTPS** functionality

## Production Checklist

- [ ] SSL certificate installed and valid
- [ ] HTTPS redirect working
- [ ] All API endpoints accessible via HTTPS
- [ ] Certificate not expired
- [ ] File permissions set correctly
- [ ] Environment variables configured
- [ ] Frontend updated to use HTTPS URLs
- [ ] SSL Labs test passed
- [ ] Mixed content issues resolved

## Support

If you encounter issues:

1. **Check logs** for specific error messages
2. **Verify certificate** validity and format
3. **Test with curl** to isolate network issues
4. **Contact hosting provider** for cPanel-specific issues
5. **Review SSL Labs report** for configuration issues
