import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import { authRoutes } from './routes/auth';
import { taxDocumentRoutes } from './routes/taxDocuments';
import { initializeHorseRoutes } from './routes/horses';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { createSSLConfig, createHTTPSOptions, redirectToHTTPS } from './utils/ssl';
import pool from './database/connection';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CORS_ORIGIN?.split(',') || ['https://gfgstable.thesuitchstaging2.com']
    : ['http://localhost:3001', 'http://localhost:8080'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Database connection is already initialized in the import

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tax-documents', taxDocumentRoutes);
app.use('/api/horses', initializeHorseRoutes(pool));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// SSL Configuration
const sslConfig = createSSLConfig();
const isProduction = process.env.NODE_ENV === 'production';
const forceSSL = process.env.FORCE_SSL === 'true';
const disableSSL = process.env.DISABLE_SSL === 'true';

// Log configuration
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`Port: ${PORT}`);
logger.info(`SSL Config Found: ${sslConfig ? 'Yes' : 'No'}`);
logger.info(`Force SSL: ${forceSSL}`);
logger.info(`Disable SSL: ${disableSSL}`);

// Start server(s)
if (sslConfig && (isProduction || forceSSL) && !disableSSL) {
  // Production with SSL
  const httpsOptions = createHTTPSOptions(sslConfig);
  const httpsServer = https.createServer(httpsOptions, app);
  
  // Start HTTPS server on configured port
  httpsServer.listen(PORT, () => {
    logger.info(`🔒 GFG Stable Backend (HTTPS) running on port ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🌐 SSL enabled with certificate`);
  });
  
  // Only start HTTP redirect server if HTTP_PORT is explicitly set and different from main port
  const httpPort = process.env.HTTP_PORT;
  if (httpPort && parseInt(httpPort) !== PORT) {
    const httpApp = express();
    httpApp.use(redirectToHTTPS);
    const httpServer = http.createServer(httpApp);
    
    httpServer.listen(httpPort, () => {
      logger.info(`🔄 HTTP redirect server running on port ${httpPort}`);
    });
  } else {
    logger.info(`ℹ️ HTTP redirect server disabled - cPanel will handle HTTPS redirect`);
  }
  
} else {
  // Development or no SSL
  const server = app.listen(PORT, () => {
    logger.info(`🚀 GFG Stable Backend running on port ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    if (!sslConfig && isProduction) {
      logger.warn('⚠️ SSL not configured - running in HTTP mode');
    }
  });
}

export default app;
