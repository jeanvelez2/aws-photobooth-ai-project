import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { processingJobService } from '../services/processingJob.js';
import { faceDetectionService } from '../services/faceDetection.js';
// import { imageProcessingService } from '../services/imageProcessing.js';
import { s3Service } from '../services/s3.js';

// Mock AWS services
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('@aws-sdk/client-rekognition');

// Mock services
vi.mock('../services/processingJob.js', () => ({
  processingJobService: {
    createJob: vi.fn(),
    getJob: vi.fn(),
    updateJobStatus: vi.fn(),
    listJobs: vi.fn(),
  },
}));

vi.mock('../services/faceDetection.js', () => ({
  faceDetectionService: {
    detectFace: vi.fn(),
  },
}));

vi.mock('../services/imageProcessing.js', () => ({
  imageProcessingService: {
    processImage: vi.fn(),
  },
}));

vi.mock('../services/s3.js', () => ({
  s3Service: {
    downloadImage: vi.fn(),
    uploadProcessedImage: vi.fn(),
  },
}));

vi.mock('../config/index.js', () => ({
  config: {
    aws: {
      s3BucketName: 'test-bucket',
      processingJobsTable: 'test-jobs-table',
    },
    processing: {
      maxRetries: 3,
      timeoutMs: 15000,
    },
  },
}));

describe.skip('Process Routes Integration', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import after clearing mocks
    const processRoutes = await import('./process.js');
    
    app = express();
    app.use(express.json());
    app.use('/api/process', processRoutes.default);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/process', () => {
    const validProcessingRequest = {
      imageKey: 'uploads/2024-01-15/test-image.jpg',
      themeId: 'barbarian',
      outputFormat: 'jpeg',
    };

    it('should create processing job successfully', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'queued',
        originalImageUrl: 'https://s3.amazonaws.com/bucket/uploads/2024-01-15/test-image.jpg',
        themeId: 'barbarian',
        createdAt: new Date(),
      };

      vi.mocked(processingJobService.createJob).mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/process')
        .send(validProcessingRequest)
        .expect(202);

      expect(response.body).toEqual({
        success: true,
        data: {
          jobId: 'job-123',
          status: 'queued',
          estimatedTime: expect.any(Number),
        },
      });

      expect(processingJobService.createJob).toHaveBeenCalledWith({
        originalImageUrl: expect.stringContaining('test-image.jpg'),
        themeId: 'barbarian',
        outputFormat: 'jpeg',
      });
    });

    it('should handle validation errors', async () => {
      const invalidRequest = {
        imageKey: '', // Invalid empty key
        themeId: 'barbarian',
        outputFormat: 'jpeg',
      };

      const response = await request(app)
        .post('/api/process')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'imageKey',
          }),
        ])
      );
    });

    it('should handle invalid theme ID', async () => {
      const invalidRequest = {
        ...validProcessingRequest,
        themeId: 'invalid-theme',
      };

      const response = await request(app)
        .post('/api/process')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle invalid output format', async () => {
      const invalidRequest = {
        ...validProcessingRequest,
        outputFormat: 'gif', // Not supported
      };

      const response = await request(app)
        .post('/api/process')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle service errors', async () => {
      const error = new Error('Database connection failed') as any;
      error.code = 'DB_CONNECTION_ERROR';
      error.statusCode = 503;

      vi.mocked(processingJobService.createJob).mockRejectedValue(error);

      const response = await request(app)
        .post('/api/process')
        .send(validProcessingRequest)
        .expect(503);

      expect(response.body).toEqual({
        error: 'Database connection failed',
        code: 'DB_CONNECTION_ERROR',
      });
    });
  });

  describe('GET /api/process/:id', () => {
    it('should return job status for existing job', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'processing',
        originalImageUrl: 'https://s3.amazonaws.com/bucket/uploads/test.jpg',
        themeId: 'barbarian',
        createdAt: new Date(),
        progress: 45,
      };

      vi.mocked(processingJobService.getJob).mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/process/job-123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: 'job-123',
          status: 'processing',
          progress: 45,
          themeId: 'barbarian',
          createdAt: expect.any(String),
        },
      });
    });

    it('should return completed job with result URL', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'completed',
        originalImageUrl: 'https://s3.amazonaws.com/bucket/uploads/test.jpg',
        resultImageUrl: 'https://s3.amazonaws.com/bucket/processed/result.jpg',
        themeId: 'barbarian',
        createdAt: new Date(),
        completedAt: new Date(),
        processingTimeMs: 8500,
      };

      vi.mocked(processingJobService.getJob).mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/process/job-123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://s3.amazonaws.com/bucket/processed/result.jpg',
          themeId: 'barbarian',
          processingTime: 8500,
          createdAt: expect.any(String),
          completedAt: expect.any(String),
        },
      });
    });

    it('should return failed job with error details', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'failed',
        originalImageUrl: 'https://s3.amazonaws.com/bucket/uploads/test.jpg',
        themeId: 'barbarian',
        error: 'NO_FACE_DETECTED',
        errorMessage: 'No face detected in the uploaded image',
        createdAt: new Date(),
        completedAt: new Date(),
      };

      vi.mocked(processingJobService.getJob).mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/process/job-123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: 'job-123',
          status: 'failed',
          error: 'NO_FACE_DETECTED',
          errorMessage: 'No face detected in the uploaded image',
          themeId: 'barbarian',
          createdAt: expect.any(String),
          completedAt: expect.any(String),
        },
      });
    });

    it('should return 404 for non-existent job', async () => {
      vi.mocked(processingJobService.getJob).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/process/non-existent-job')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Processing job not found',
        code: 'JOB_NOT_FOUND',
      });
    });

    it('should handle invalid job ID format', async () => {
      const response = await request(app)
        .get('/api/process/invalid-id-format!')
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle service errors when fetching job', async () => {
      const error = new Error('Database timeout') as any;
      error.code = 'DB_TIMEOUT';
      error.statusCode = 503;

      vi.mocked(processingJobService.getJob).mockRejectedValue(error);

      const response = await request(app)
        .get('/api/process/job-123')
        .expect(503);

      expect(response.body).toEqual({
        error: 'Database timeout',
        code: 'DB_TIMEOUT',
      });
    });
  });

  describe('End-to-End Processing Workflow', () => {
    it('should handle complete processing workflow', async () => {
      // Step 1: Create processing job
      const mockJob = {
        id: 'job-123',
        status: 'queued',
        originalImageUrl: 'https://s3.amazonaws.com/bucket/uploads/test.jpg',
        themeId: 'barbarian',
        createdAt: new Date(),
      };

      vi.mocked(processingJobService.createJob).mockResolvedValue(mockJob);

      const createResponse = await request(app)
        .post('/api/process')
        .send({
          imageKey: 'uploads/test.jpg',
          themeId: 'barbarian',
          outputFormat: 'jpeg',
        })
        .expect(202);

      expect(createResponse.body.data.jobId).toBe('job-123');

      // Step 2: Check job status (processing)
      const processingJob = {
        ...mockJob,
        status: 'processing',
        progress: 50,
      };

      vi.mocked(processingJobService.getJob).mockResolvedValue(processingJob);

      const statusResponse = await request(app)
        .get('/api/process/job-123')
        .expect(200);

      expect(statusResponse.body.data.status).toBe('processing');
      expect(statusResponse.body.data.progress).toBe(50);

      // Step 3: Check job completion
      const completedJob = {
        ...mockJob,
        status: 'completed',
        resultImageUrl: 'https://s3.amazonaws.com/bucket/processed/result.jpg',
        completedAt: new Date(),
        processingTimeMs: 8500,
      };

      vi.mocked(processingJobService.getJob).mockResolvedValue(completedJob);

      const completedResponse = await request(app)
        .get('/api/process/job-123')
        .expect(200);

      expect(completedResponse.body.data.status).toBe('completed');
      expect(completedResponse.body.data.resultUrl).toBe('https://s3.amazonaws.com/bucket/processed/result.jpg');
      expect(completedResponse.body.data.processingTime).toBe(8500);
    });

    it('should handle processing failure workflow', async () => {
      // Create job
      const mockJob = {
        id: 'job-123',
        status: 'queued',
        originalImageUrl: 'https://s3.amazonaws.com/bucket/uploads/test.jpg',
        themeId: 'barbarian',
        createdAt: new Date(),
      };

      vi.mocked(processingJobService.createJob).mockResolvedValue(mockJob);

      await request(app)
        .post('/api/process')
        .send({
          imageKey: 'uploads/test.jpg',
          themeId: 'barbarian',
          outputFormat: 'jpeg',
        })
        .expect(202);

      // Check failed job status
      const failedJob = {
        ...mockJob,
        status: 'failed',
        error: 'NO_FACE_DETECTED',
        errorMessage: 'No face detected in the uploaded image',
        completedAt: new Date(),
      };

      vi.mocked(processingJobService.getJob).mockResolvedValue(failedJob);

      const failedResponse = await request(app)
        .get('/api/process/job-123')
        .expect(200);

      expect(failedResponse.body.data.status).toBe('failed');
      expect(failedResponse.body.data.error).toBe('NO_FACE_DETECTED');
      expect(failedResponse.body.data.errorMessage).toBe('No face detected in the uploaded image');
    });
  });

  describe('Rate Limiting and Concurrency', () => {
    it('should handle multiple concurrent requests', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'queued',
        originalImageUrl: 'https://s3.amazonaws.com/bucket/uploads/test.jpg',
        themeId: 'barbarian',
        createdAt: new Date(),
      };

      vi.mocked(processingJobService.createJob).mockResolvedValue(mockJob);

      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/process')
          .send({
            imageKey: `uploads/test-${i}.jpg`,
            themeId: 'barbarian',
            outputFormat: 'jpeg',
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(202);
        expect(response.body.success).toBe(true);
      });
    });
  });
});