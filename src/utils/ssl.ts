import https from 'https';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export interface SSLConfig {
  keyPath?: string;
  certPath?: string;
  caPath?: string;
  key?: string;
  cert?: string;
  ca?: string;
}

export function createSSLConfig(): SSLConfig | null {
  const sslConfig: SSLConfig = {};

  // Check for SSL certificate files
  const keyPath = process.env.SSL_KEY_PATH || path.join(process.cwd(), 'ssl', 'private.key');
  const certPath = process.env.SSL_CERT_PATH || path.join(process.cwd(), 'ssl', 'certificate.crt');
  const caPath = process.env.SSL_CA_PATH || path.join(process.cwd(), 'ssl', 'ca-bundle.crt');

  try {
    // Try to read certificate files
    if (fs.existsSync(keyPath)) {
      sslConfig.key = fs.readFileSync(keyPath, 'utf8');
      logger.info(`SSL private key loaded from file: ${keyPath}`);
    } else if (process.env.SSL_KEY) {
      sslConfig.key = process.env.SSL_KEY;
      logger.info('SSL private key loaded from environment variable');
    } else {
      logger.warn(`SSL private key not found at: ${keyPath}`);
    }

    if (fs.existsSync(certPath)) {
      sslConfig.cert = fs.readFileSync(certPath, 'utf8');
      logger.info(`SSL certificate loaded from file: ${certPath}`);
    } else if (process.env.SSL_CERT) {
      sslConfig.cert = process.env.SSL_CERT;
      logger.info('SSL certificate loaded from environment variable');
    } else {
      logger.warn(`SSL certificate not found at: ${certPath}`);
    }

    if (fs.existsSync(caPath)) {
      sslConfig.ca = fs.readFileSync(caPath, 'utf8');
      logger.info(`SSL CA bundle loaded from file: ${caPath}`);
    } else if (process.env.SSL_CA) {
      sslConfig.ca = process.env.SSL_CA;
      logger.info('SSL CA bundle loaded from environment variable');
    } else {
      logger.info(`SSL CA bundle not found at: ${caPath} (optional)`);
    }

    // Validate SSL configuration
    if (!sslConfig.key || !sslConfig.cert) {
      logger.warn('SSL configuration incomplete - HTTPS will not be enabled');
      logger.warn('Set SSL_KEY_PATH and SSL_CERT_PATH environment variables or provide SSL_KEY and SSL_CERT');
      return null;
    }

    return sslConfig;
  } catch (error) {
    logger.error('Error loading SSL configuration:', error);
    return null;
  }
}

export function createHTTPSOptions(sslConfig: SSLConfig): https.ServerOptions {
  const options: https.ServerOptions = {
    key: sslConfig.key,
    cert: sslConfig.cert,
  };

  if (sslConfig.ca) {
    options.ca = sslConfig.ca;
  }

  return options;
}

export function redirectToHTTPS(req: any, res: any, next: any) {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
}
