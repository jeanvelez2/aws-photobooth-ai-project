import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import uploadRouter from './upload.js';
import { s3Service } from '../services/s3.js';

// Mock the S3 service
vi.mock('../services/s3.js', () => ({
  s3Service: {
    generatePresignedUploadUrl: vi.fn(),
  },
}));

// Mock the logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock the error handler middleware
vi.mock('../middleware/errorHandler.js', () => ({
  asyncHandler: (fn: any) => fn,
}));

// Mock the rate limiting middleware
vi.mock('../middleware/rateLimiting.js', () => ({
  uploadRateLimiter: (req: any, res: any, next: any) => next(),
}));

// Mock the validation middleware to use the original validation logic
vi.mock('../middleware/validation.js', async () => {
  const actual = await vi.importActual('../middleware/validation.js');
  return actual;
});

const mockS3Service = vi.mocked(s3Service);

describe('Upload Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/upload', uploadRouter);
    vi.clearAllMocks();
  });

  describe('POST /api/upload/presigned', () => {
    const validRequestBody = {
      fileName: 'test-image.jpg',
      fileType: 'image/jpeg',
      fileSize: 1024 * 1024, // 1MB
    };

    it('should generate presigned URL successfully', async () => {
      const mockResponse = {
        uploadUrl: 'https://test-bucket.s3.amazonaws.com/presigned-url',
        key: 'uploads/2024-01-15/test-uuid.jpg',
        expiresIn: 900,
      };

      mockS3Service.generatePresignedUploadUrl.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(validRequestBody)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResponse,
      });

      expect(mockS3Service.generatePresignedUploadUrl).toHaveBeenCalledWith({
        fileName: 'test-image.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024 * 1024,
      });
    });

    it('should return 400 for missing fileName', async () => {
      const invalidBody = {
        fileType: 'image/jpeg',
        fileSize: 1024 * 1024,
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'fileName',
          }),
        ])
      );
    });

    it('should return 400 for invalid fileName (empty string)', async () => {
      const invalidBody = {
        ...validRequestBody,
        fileName: '',
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid fileName (too long)', async () => {
      const invalidBody = {
        ...validRequestBody,
        fileName: 'a'.repeat(256), // 256 characters
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing fileType', async () => {
      const invalidBody = {
        fileName: 'test.jpg',
        fileSize: 1024 * 1024,
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'fileType',
          }),
        ])
      );
    });

    it('should return 400 for invalid fileType', async () => {
      const invalidBody = {
        ...validRequestBody,
        fileType: 'image/gif',
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for non-image fileType', async () => {
      const invalidBody = {
        ...validRequestBody,
        fileType: 'text/plain',
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing fileSize', async () => {
      const invalidBody = {
        fileName: 'test.jpg',
        fileType: 'image/jpeg',
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: 'fileSize',
          }),
        ])
      );
    });

    it('should return 400 for zero fileSize', async () => {
      const invalidBody = {
        ...validRequestBody,
        fileSize: 0,
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for negative fileSize', async () => {
      const invalidBody = {
        ...validRequestBody,
        fileSize: -1,
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for fileSize exceeding 10MB', async () => {
      const invalidBody = {
        ...validRequestBody,
        fileSize: 11 * 1024 * 1024, // 11MB
      };

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(invalidBody)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should accept valid PNG files', async () => {
      const pngRequest = {
        ...validRequestBody,
        fileName: 'test.png',
        fileType: 'image/png',
      };

      const mockResponse = {
        uploadUrl: 'https://test-bucket.s3.amazonaws.com/presigned-url',
        key: 'uploads/2024-01-15/test-uuid.png',
        expiresIn: 900,
      };

      mockS3Service.generatePresignedUploadUrl.mockResolvedValue(mockResponse);

      await request(app)
        .post('/api/upload/presigned')
        .send(pngRequest)
        .expect(200);
    });

    it('should accept valid WebP files', async () => {
      const webpRequest = {
        ...validRequestBody,
        fileName: 'test.webp',
        fileType: 'image/webp',
      };

      const mockResponse = {
        uploadUrl: 'https://test-bucket.s3.amazonaws.com/presigned-url',
        key: 'uploads/2024-01-15/test-uuid.webp',
        expiresIn: 900,
      };

      mockS3Service.generatePresignedUploadUrl.mockResolvedValue(mockResponse);

      await request(app)
        .post('/api/upload/presigned')
        .send(webpRequest)
        .expect(200);
    });

    it('should handle S3 service validation errors', async () => {
      const error = new Error('Invalid file type') as any;
      error.code = 'INVALID_FILE_TYPE';
      error.statusCode = 400;

      mockS3Service.generatePresignedUploadUrl.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(validRequestBody)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid file type',
        code: 'INVALID_FILE_TYPE',
      });
    });

    it('should handle S3 service file size errors', async () => {
      const error = new Error('File size exceeds maximum limit') as any;
      error.code = 'FILE_TOO_LARGE';
      error.statusCode = 413;

      mockS3Service.generatePresignedUploadUrl.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(validRequestBody)
        .expect(413);

      expect(response.body).toEqual({
        error: 'File size exceeds maximum limit',
        code: 'FILE_TOO_LARGE',
      });
    });

    it('should handle S3 service internal errors', async () => {
      const error = new Error('Failed to generate upload URL') as any;
      error.code = 'S3_OPERATION_FAILED';
      error.statusCode = 500;

      mockS3Service.generatePresignedUploadUrl.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(validRequestBody)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to generate upload URL',
        code: 'S3_OPERATION_FAILED',
      });
    });

    it('should handle unexpected errors', async () => {
      mockS3Service.generatePresignedUploadUrl.mockRejectedValue(
        new Error('Unexpected error')
      );

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(validRequestBody)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockS3Service.generatePresignedUploadUrl.mockRejectedValue('String error');

      const response = await request(app)
        .post('/api/upload/presigned')
        .send(validRequestBody)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should accept maximum allowed file size (10MB)', async () => {
      const maxSizeRequest = {
        ...validRequestBody,
        fileSize: 10 * 1024 * 1024, // Exactly 10MB
      };

      const mockResponse = {
        uploadUrl: 'https://test-bucket.s3.amazonaws.com/presigned-url',
        key: 'uploads/2024-01-15/test-uuid.jpg',
        expiresIn: 900,
      };

      mockS3Service.generatePresignedUploadUrl.mockResolvedValue(mockResponse);

      await request(app)
        .post('/api/upload/presigned')
        .send(maxSizeRequest)
        .expect(200);
    });

    it('should accept minimum file size (1 byte)', async () => {
      const minSizeRequest = {
        ...validRequestBody,
        fileSize: 1,
      };

      const mockResponse = {
        uploadUrl: 'https://test-bucket.s3.amazonaws.com/presigned-url',
        key: 'uploads/2024-01-15/test-uuid.jpg',
        expiresIn: 900,
      };

      mockS3Service.generatePresignedUploadUrl.mockResolvedValue(mockResponse);

      await request(app)
        .post('/api/upload/presigned')
        .send(minSizeRequest)
        .expect(200);
    });
  });
});