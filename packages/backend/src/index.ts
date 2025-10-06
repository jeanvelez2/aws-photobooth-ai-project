import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { configService } from './services/configService.js';
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
import { startWorkers } from './workers/index.js';
import { performanceMonitoring, checkSystemPerformance } from './middleware/performanceMonitoring.js';
import apiRoutes from './routes/index.js';
import healthRoutes from './routes/health.js';

const app = express();

// Reusable sanitization helper
const escapeMap: { [key: string]: string } = {
  '\r': '', '\n': '', '\t': '', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'
};
const sanitizeForLog = (input: string) => input.replace(/[\r\n\t<>"'&]/g, (match) => escapeMap[match] || match);

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

// CSRF protection helper
const validateCSRF = (req: express.Request, res: express.Response) => {
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'https://localhost:3000',
    'https://d1sb1uvkfiy4hq.cloudfront.net'
  ];
  
  // Allow ALB URLs for deployment scripts
  const albPattern = /^https?:\/\/photobooth-alb-[a-z]+-\d+\.[a-z0-9-]+\.elb\.amazonaws\.com$/;
  if (origin && albPattern.test(origin)) {
    allowedOrigins.push(origin);
  }
  
  if (!origin && !referer) {
    return res.status(403).json({
      error: 'CSRF protection: Missing origin/referer headers',
      code: 'CSRF_PROTECTION'
    });
  }
  
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch (error) {
      return res.status(403).json({
        error: 'CSRF protection: Invalid referer format',
        code: 'CSRF_PROTECTION'
      });
    }
  }
  
  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
    return res.status(403).json({
      error: 'CSRF protection: Invalid origin',
      code: 'CSRF_PROTECTION'
    });
  }
  
  return null;
};

// CSRF protection for state-changing requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const csrfError = validateCSRF(req, res);
    if (csrfError) return;
  }
  next();
});

// Temporarily disable security headers for debugging
// app.use(securityHeaders);

// Basic helmet configuration (additional to our custom security headers)
app.use(helmet({
  contentSecurityPolicy: false, // We handle this in securityHeaders
  crossOriginEmbedderPolicy: false,
}));

// Secure cookie configuration
app.use(secureCookies);

// Request size limiting
app.use(requestSizeLimiter(10 * 1024 * 1024)); // 10MB limit

// CORS configuration with strict SSRF protection
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'https://localhost:3000',
      'https://d1sb1uvkfiy4hq.cloudfront.net'
    ];
    
    // Add specific CloudFront distribution if configured
    if (process.env.CLOUDFRONT_DOMAIN) {
      allowedOrigins.push(`https://${process.env.CLOUDFRONT_DOMAIN}`);
    }
    
    // Allow ALB URLs for deployment scripts
    const albPattern = /^https?:\/\/photobooth-alb-[a-z]+-\d+\.[a-z0-9-]+\.elb\.amazonaws\.com$/;
    if (origin && albPattern.test(origin)) {
      allowedOrigins.push(origin);
    }
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Only allow exact matches from whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-S3-Bucket-URL'],
}));

// Progressive rate limiting (checks for suspicious IPs first)
app.use(progressiveRateLimiter);

// Note: Specific rate limiting is applied at the route level
// This allows different endpoints to have different rate limits

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

// Health check routes (mounted at /health to avoid conflicts)
app.use('/health', healthRoutes);

// Handle POST requests to root path (common misconfiguration)
app.post('/', generalRateLimiter, (req, res) => {
  // CSRF protection - validate origin header
  const csrfError = validateCSRF(req, res);
  if (csrfError) return;
  const requestId = req.headers['x-request-id'] as string;
  
  // Sanitize user-controlled input to prevent log injection and XSS
  const sanitizedUserAgent = req.get('User-Agent')?.replace(/[\r\n\t<>"'&]/g, '') || 'unknown';
  const sanitizedRequestId = requestId?.replace(/[\r\n\t<>"'&]/g, '') || 'unknown';
  
  logger.warn('POST request to root path - should use /api/process', { 
    requestId: sanitizedRequestId, 
    ip: req.ip,
    userAgent: sanitizedUserAgent,
    bodyKeys: req.body ? Object.keys(req.body).length : 0
  });

  res.status(400).json({
    error: 'Invalid endpoint',
    message: 'POST requests should be sent to /api/process for photo processing',
    correctEndpoint: '/api/process'
  });
});

// Performance monitoring middleware
app.use(performanceMonitoring);

// API routes
app.use('/api', apiRoutes);

// 404 handler for API routes - catch unmatched API routes
app.use('/api', (req, res, next) => {
  if (!res.headersSent) {
    // Sanitize user-controlled input to prevent log injection and XSS
    const sanitizedPath = sanitizeForLog(req.path);
    const sanitizedMethod = sanitizeForLog(req.method || 'UNKNOWN');
    
    logger.warn('API route not found', {
      path: sanitizedPath,
      method: sanitizedMethod,
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

app.listen(port, async () => {
  logger.info(`Server running on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start background workers
  if (process.env.NODE_ENV !== 'test') {
    await startWorkers();
    checkSystemPerformance();
  }
});
