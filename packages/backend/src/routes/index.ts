import { Router, Request, Response } from 'express';
import themesRouter from './themes.js';
import uploadRouter from './upload.js';
import processRouter from './process.js';
import privacyRouter from './privacy.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { healthCheckRateLimiter, generalRateLimiter } from '../middleware/rateLimiting.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Health check endpoint
router.get('/health', healthCheckRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.info('Health check requested', { requestId });

  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  res.json(healthData);
}));

// API info endpoint
router.get('/', generalRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.info('API info requested', { requestId });

  res.json({
    message: 'AI Photobooth API',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      health: '/api/health',
      themes: '/api/themes',
      upload: '/api/upload',
      process: '/api/process',
      privacy: '/api/privacy',
    },
  });
}));

// Mount theme routes (with general rate limiting)
router.use('/themes', generalRateLimiter, themesRouter);

// Mount upload routes (with general rate limiting)
router.use('/upload', generalRateLimiter, uploadRouter);

// Mount process routes (has its own specific rate limiting)
router.use('/process', processRouter);

// Mount privacy routes (with general rate limiting)
router.use('/privacy', generalRateLimiter, privacyRouter);

export default router;