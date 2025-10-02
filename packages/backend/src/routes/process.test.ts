import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import processRouter from './process.js';
import type { ProcessingJob } from '../../../shared/src/types/models.js';

// Mock job queue
vi.mock('../services/jobQueue.js', () => ({
  jobQueue: {
    enqueueJob: vi.fn(),
    getJobStatus: vi.fn(),
    cancelJobRetry: vi.fn(),
    getQueueStats: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Process Routes', () => {
  let app: express.Application;
  let mockJobQueue: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked job queue
    const { jobQueue } = await import('../services/jobQueue.js');
    mockJobQueue = jobQueue;
    
    app = express();
    app.use(express.json());
    app.use('/api/process', processRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/process', () => {
    it('should create a processing job successfully', async () => {
      // Arrange
      const requestBody = {
        photoId: 'photo-123',
        themeId: 'theme-456',
        variantId: 'variant-789',
        outputFormat: 'jpeg',
        userId: 'user-123',
        originalImageUrl: 'https://example.com/image.jpg',
      };

      const mockJob: ProcessingJob = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'queued',
        createdAt: new Date(),
        themeId: 'theme-456',
        variantId: 'variant-789',
        outputFormat: 'jpeg',
        retryCount: 0,
        originalImageUrl: 'https://example.com/image.jpg',
        userId: 'user-123',
      };

      mockJobQueue.enqueueJob.mockResolvedValueOnce(mockJob);

      // Act
      const response = await request(app)
        .post('/api/process')
        .send(requestBody)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'queued',
        themeId: 'theme-456',
        variantId: 'variant-789',
        outputFormat: 'jpeg',
      });
      expect(mockJobQueue.enqueueJob).toHaveBeenCalledWith(requestBody);
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidRequestBody = {
        photoId: '', // Invalid: empty string
        themeId: 'theme-456',
        originalImageUrl: 'not-a-url', // Invalid: not a URL
      };

      // Act
      const response = await request(app)
        .post('/api/process')
        .send(invalidRequestBody)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(mockJobQueue.enqueueJob).not.toHaveBeenCalled();
    });

    it('should handle job creation errors', async () => {
      // Arrange
      const requestBody = {
        photoId: 'photo-123',
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockJobQueue.enqueueJob.mockRejectedValueOnce(new Error('Job creation failed'));

      // Act
      const response = await request(app)
        .post('/api/process')
        .send(requestBody)
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to create processing job');
    });

    it('should default outputFormat to jpeg', async () => {
      // Arrange
      const requestBody = {
        photoId: 'photo-123',
        themeId: 'theme-456',
        originalImageUrl: 'https://example.com/image.jpg',
        // outputFormat not specified
      };

      const mockJob: ProcessingJob = {
        id: '550e8400-e29b-41d4-a716-446655440008',
        status: 'queued',
        createdAt: new Date(),
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        retryCount: 0,
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockJobQueue.enqueueJob.mockResolvedValueOnce(mockJob);

      // Act
      const response = await request(app)
        .post('/api/process')
        .send(requestBody)
        .expect(201);

      // Assert
      expect(response.body.outputFormat).toBe('jpeg');
      expect(mockJobQueue.enqueueJob).toHaveBeenCalledWith({
        ...requestBody,
        outputFormat: 'jpeg',
      });
    });
  });

  describe('GET /api/process/:id', () => {
    it('should return job status for queued job', async () => {
      // Arrange
      const jobId = '550e8400-e29b-41d4-a716-446655440000';
      const mockJob: ProcessingJob = {
        id: jobId,
        status: 'queued',
        createdAt: new Date(),
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        retryCount: 0,
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockJobQueue.getJobStatus.mockResolvedValueOnce(mockJob);

      // Act
      const response = await request(app)
        .get(`/api/process/${jobId}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: jobId,
        status: 'queued',
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        retryCount: 0,
      });
      expect(response.body).not.toHaveProperty('resultUrl');
      expect(response.body).not.toHaveProperty('error');
    });

    it('should return job status with result URL for completed job', async () => {
      // Arrange
      const jobId = '550e8400-e29b-41d4-a716-446655440001';
      const mockJob: ProcessingJob = {
        id: jobId,
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        retryCount: 0,
        originalImageUrl: 'https://example.com/image.jpg',
        resultImageUrl: 'https://example.com/result.jpg',
        processingTimeMs: 5000,
      };

      mockJobQueue.getJobStatus.mockResolvedValueOnce(mockJob);

      // Act
      const response = await request(app)
        .get(`/api/process/${jobId}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: jobId,
        status: 'completed',
        resultUrl: 'https://example.com/result.jpg',
        processingTimeMs: 5000,
      });
      expect(response.body).toHaveProperty('completedAt');
    });

    it('should return job status with error for failed job', async () => {
      // Arrange
      const jobId = '550e8400-e29b-41d4-a716-446655440002';
      const mockJob: ProcessingJob = {
        id: jobId,
        status: 'failed',
        createdAt: new Date(),
        completedAt: new Date(),
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        retryCount: 3,
        originalImageUrl: 'https://example.com/image.jpg',
        error: 'Processing failed: No face detected',
      };

      mockJobQueue.getJobStatus.mockResolvedValueOnce(mockJob);

      // Act
      const response = await request(app)
        .get(`/api/process/${jobId}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        id: jobId,
        status: 'failed',
        error: 'Processing failed: No face detected',
        retryCount: 3,
      });
    });

    it('should return 404 for non-existent job', async () => {
      // Arrange
      const jobId = '550e8400-e29b-41d4-a716-446655440003';
      mockJobQueue.getJobStatus.mockResolvedValueOnce(null);

      // Act
      const response = await request(app)
        .get(`/api/process/${jobId}`)
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'Job not found');
    });

    it('should validate job ID format', async () => {
      // Arrange
      const invalidJobId = 'invalid-uuid';

      // Act
      const response = await request(app)
        .get(`/api/process/${invalidJobId}`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error', 'Invalid job ID');
      expect(mockJobQueue.getJobStatus).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      // Arrange
      const jobId = '550e8400-e29b-41d4-a716-446655440004';
      mockJobQueue.getJobStatus.mockRejectedValueOnce(new Error('Service error'));

      // Act
      const response = await request(app)
        .get(`/api/process/${jobId}`)
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to retrieve job status');
    });
  });

  describe('DELETE /api/process/:id', () => {
    it('should cancel a queued job successfully', async () => {
      // Arrange
      const jobId = '550e8400-e29b-41d4-a716-446655440005';
      const mockJob: ProcessingJob = {
        id: jobId,
        status: 'queued',
        createdAt: new Date(),
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        retryCount: 0,
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockJobQueue.getJobStatus.mockResolvedValueOnce(mockJob);
      mockJobQueue.cancelJobRetry.mockResolvedValueOnce(undefined);

      // Act
      const response = await request(app)
        .delete(`/api/process/${jobId}`)
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        message: 'Job cancelled successfully',
        jobId,
      });
      expect(mockJobQueue.cancelJobRetry).toHaveBeenCalledWith(jobId);
    });

    it('should not allow cancellation of processing job', async () => {
      // Arrange
      const jobId = '550e8400-e29b-41d4-a716-446655440006';
      const mockJob: ProcessingJob = {
        id: jobId,
        status: 'processing',
        createdAt: new Date(),
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        retryCount: 0,
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockJobQueue.getJobStatus.mockResolvedValueOnce(mockJob);

      // Act
      const response = await request(app)
        .delete(`/api/process/${jobId}`)
        .expect(400);

      // Assert
      expect(response.body).toHaveProperty('error', 'Job cannot be cancelled');
      expect(response.body.message).toContain('currently processing');
      expect(mockJobQueue.cancelJobRetry).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent job', async () => {
      // Arrange
      const jobId = '550e8400-e29b-41d4-a716-446655440007';
      mockJobQueue.getJobStatus.mockResolvedValueOnce(null);

      // Act
      const response = await request(app)
        .delete(`/api/process/${jobId}`)
        .expect(404);

      // Assert
      expect(response.body).toHaveProperty('error', 'Job not found');
    });
  });

  describe('GET /api/process/stats/queue', () => {
    it('should return queue statistics', async () => {
      // Arrange
      const mockStats = {
        queued: 5,
        processing: 2,
        completed: 100,
        failed: 3,
      };

      mockJobQueue.getQueueStats.mockResolvedValueOnce(mockStats);

      // Act
      const response = await request(app)
        .get('/api/process/stats/queue')
        .expect(200);

      // Assert
      expect(response.body).toEqual(mockStats);
    });

    it('should handle service errors', async () => {
      // Arrange
      mockJobQueue.getQueueStats.mockRejectedValueOnce(new Error('Stats error'));

      // Act
      const response = await request(app)
        .get('/api/process/stats/queue')
        .expect(500);

      // Assert
      expect(response.body).toHaveProperty('error', 'Failed to retrieve queue statistics');
    });
  });
});