import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { metricsMiddleware, healthMetricsMiddleware } from './middleware/metrics.js';
import { xrayMiddleware, xrayCloseMiddleware } from './middleware/xray.js';
import { 
  securityHeaders, 
  httpsEnforcement, 
  secureCookies, 
  requestSizeLimiter,
  securityMonitoring 
} from './middleware/security.js';
import { 
  generalRateLimiter, 
  progressiveRateLimiter 
} from './middleware/rateLimiting.js';
import { 
  sanitizeInput, 
  securityValidation, 
  validateContentType 
} from './middleware/validation.js';
import { jobCleanupService } from './services/jobCleanup.js';
import { processingWorker } from './services/processingWorker.js';
import { cleanupScheduler } from './jobs/cleanupScheduler.js';
import apiRoutes from './routes/index.js';
import healthRoutes from './routes/health.js';

const app = express();

// Trust proxy for accurate IP addresses (important for rate limiting and security)
app.set('trust proxy', 1);

// X-Ray tracing (must be first for complete request tracing)
app.use(xrayMiddleware);

// Correlation ID middleware (early for request tracking)
app.use(correlationMiddleware);

// HTTPS enforcement (must be early in middleware chain)
app.use(httpsEnforcement);

// Request logging middleware (should be after correlation ID)
app.use(requestLogger);

// Metrics middleware (track all requests)
app.use(metricsMiddleware);

// Security monitoring (detect suspicious patterns early)
app.use(securityMonitoring);

// Enhanced security headers
app.use(securityHeaders);

// Basic helmet configuration (additional to our custom security headers)
app.use(helmet({
  contentSecurityPolicy: false, // We handle this in securityHeaders
  crossOriginEmbedderPolicy: false,
}));

// Secure cookie configuration
app.use(secureCookies);

// Request size limiting
app.use(requestSizeLimiter(10 * 1024 * 1024)); // 10MB limit

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? [
            process.env.FRONTEND_URL,
            'https://d1sb1uvkfiy4hq.cloudfront.net'
          ].filter(Boolean)
        : ['http://localhost:3000', 'http://localhost:5173'];
      
      // Also allow any CloudFront domain in production
      const isCloudFront = process.env.NODE_ENV === 'production' && 
                          origin && origin.match(/^https:\/\/.*\.cloudfront\.net$/);
      
      if (allowedOrigins.includes(origin) || isCloudFront) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// Progressive rate limiting (checks for suspicious IPs first)
app.use(progressiveRateLimiter);

// General rate limiting for all API routes
app.use('/api', generalRateLimiter);

// Content type validation
app.use(validateContentType(['application/json', 'application/x-www-form-urlencoded']));

// Body parsing middleware with security considerations
app.use(express.json({ 
  limit: `${config.upload.maxSizeMB}mb`,
  type: ['application/json'],
  strict: true, // Only parse objects and arrays
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: `${config.upload.maxSizeMB}mb`,
  parameterLimit: 100, // Limit number of parameters
}));

// Input sanitization and security validation
app.use(sanitizeInput);
app.use(securityValidation);

// Health check routes (before API routes for priority)
app.use('/', healthRoutes);

// API routes
app.use('/api', apiRoutes);

// 404 handler for API routes - catch unmatched API routes
app.use('/api', (req, res, next) => {
  if (!res.headersSent) {
    logger.warn('API route not found', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(404).json({ 
      error: true,
      message: 'API endpoint not found',
      code: 'ENDPOINT_NOT_FOUND',
    });
  } else {
    next();
  }
});

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: true,
    message: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
  });
});

// Global error handling middleware (must be last)
app.use(errorHandler);

// X-Ray close segment middleware (must be after error handler)
app.use(xrayCloseMiddleware);

const port = config.port || 3001;

// Start health metrics collection
const stopHealthMetrics = healthMetricsMiddleware();

// Start the cleanup service and processing worker
jobCleanupService.start();
processingWorker.start();

// Start the data lifecycle cleanup scheduler
cleanupScheduler.start();

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopHealthMetrics();
  jobCleanupService.stop();
  processingWorker.stop();
  cleanupScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopHealthMetrics();
  jobCleanupService.stop();
  processingWorker.stop();
  cleanupScheduler.stop();
  process.exit(0);
});

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
