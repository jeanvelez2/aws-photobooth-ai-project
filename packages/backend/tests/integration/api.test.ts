import request from 'supertest';
import { app } from '../../src/index.js';

describe('API Integration Tests', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Themes API', () => {
    it('should return list of themes', async () => {
      const response = await request(app)
        .get('/api/themes')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return specific theme by id', async () => {
      const response = await request(app)
        .get('/api/themes/barbarian')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'barbarian');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('variants');
    });

    it('should return 404 for non-existent theme', async () => {
      await request(app)
        .get('/api/themes/nonexistent')
        .expect(404);
    });
  });

  describe('Upload API', () => {
    it('should generate pre-signed URL', async () => {
      const response = await request(app)
        .post('/api/upload/presigned-url')
        .send({
          fileName: 'test.jpg',
          fileType: 'image/jpeg'
        })
        .expect(200);

      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body).toHaveProperty('key');
    });

    it('should validate file type', async () => {
      await request(app)
        .post('/api/upload/presigned-url')
        .send({
          fileName: 'test.txt',
          fileType: 'text/plain'
        })
        .expect(400);
    });
  });

  describe('Processing API', () => {
    it('should create processing job', async () => {
      const response = await request(app)
        .post('/api/process')
        .send({
          photoId: 'test-photo-123',
          themeId: 'barbarian',
          originalImageUrl: 'https://example.com/test.jpg'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'queued');
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/process')
        .send({
          photoId: 'test-photo-123'
          // Missing themeId and originalImageUrl
        })
        .expect(400);
    });

    it('should get job status', async () => {
      // First create a job
      const createResponse = await request(app)
        .post('/api/process')
        .send({
          photoId: 'test-photo-123',
          themeId: 'barbarian',
          originalImageUrl: 'https://example.com/test.jpg'
        });

      const jobId = createResponse.body.id;

      // Then get its status
      const response = await request(app)
        .get(`/api/process/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', jobId);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on processing endpoint', async () => {
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/process')
          .send({
            photoId: 'test-photo-123',
            themeId: 'barbarian',
            originalImageUrl: 'https://example.com/test.jpg'
          })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/process')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing endpoints', async () => {
      await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });
  });
});