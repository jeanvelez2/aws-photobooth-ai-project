import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from './index.js';
import { requestLogger } from '../middleware/requestLogger.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);
  app.use('/api', apiRoutes);
  app.use(errorHandler);
  return app;
};

describe('API Routes', () => {
  const app = createTestApp();

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      
      // Validate timestamp format
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
      
      // Validate memory structure
      expect(response.body.memory).toHaveProperty('rss');
      expect(response.body.memory).toHaveProperty('heapTotal');
      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('external');
    });

    it('should include request ID in response headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-request-id');
    });
  });

  describe('GET /api', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'AI Photobooth API');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('health', '/api/health');
      expect(response.body.endpoints).toHaveProperty('themes', '/api/themes');
    });
  });

  describe('Theme routes integration', () => {
    it('should access themes through main router', async () => {
      const response = await request(app)
        .get('/api/themes')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should access specific theme through main router', async () => {
      const response = await request(app)
        .get('/api/themes/barbarian')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'barbarian');
    });
  });
});