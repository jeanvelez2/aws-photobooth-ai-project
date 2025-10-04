import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';
import { config } from './config/index.js';

// Create the same app configuration as in index.ts
const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestLogger);
  
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100, // Higher limit for tests
    message: {
      error: true,
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', limiter);
  app.use(express.json({ limit: `${config.upload.maxSizeMB}mb` }));
  app.use(express.urlencoded({ extended: true, limit: `${config.upload.maxSizeMB}mb` }));
  app.use('/api', apiRoutes);
  
  // 404 handler for API routes
  app.use('/api', (req, res, next) => {
    if (!res.headersSent) {
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
  
  app.use(errorHandler);

  return app;
};

describe('Server Integration', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('Server Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should handle rate limiting', async () => {
      // Create a separate app with strict rate limiting for this test
      const testApp = express();
      testApp.set('trust proxy', 1);
      
      const strictLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 5, // Very low limit for testing
        message: {
          error: true,
          message: 'Too many requests from this IP, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
      });
      
      testApp.use('/api', strictLimiter);
      testApp.get('/api/test', (req, res) => res.json({ ok: true }));
      
      // Make multiple requests to trigger rate limit
      const requests = Array(8).fill(null).map(() => 
        request(testApp).get('/api/test')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle JSON body parsing', async () => {
      const response = await request(app)
        .post('/api/nonexistent')
        .set('Origin', 'http://localhost:3000')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      // Should parse JSON but return 404 for non-existent endpoint
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', true);
    });

    it('should handle 404 for unknown API routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('code', 'ENDPOINT_NOT_FOUND');
    });

    it('should handle 404 for non-API routes', async () => {
      const response = await request(app)
        .get('/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('code', 'ROUTE_NOT_FOUND');
    });
  });

  describe('API Endpoints Integration', () => {
    it('should serve health endpoint with all middleware', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should serve themes endpoint with all middleware', async () => {
      const response = await request(app)
        .get('/api/themes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should handle theme by ID with proper error handling', async () => {
      const response = await request(app)
        .get('/api/themes/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', true);
      expect(response.body).toHaveProperty('code', 'THEME_NOT_FOUND');
      expect(response.headers).toHaveProperty('x-request-id');
    });
  });
});