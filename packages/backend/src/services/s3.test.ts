import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { S3Service, S3UploadError } from './s3.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock the AWS SDK
vi.mock('@aws-sdk/s3-request-presigner');
vi.mock('./aws.js', () => ({
  s3Client: {},
}));

// Mock the AWS client pool
vi.mock('./awsClientPool.js', () => ({
  s3ClientPool: {
    execute: vi.fn().mockImplementation(async (fn) => {
      // Mock S3 client
      const mockClient = {
        send: vi.fn().mockResolvedValue({}),
      };
      return await fn(mockClient);
    }),
  },
}));

// Mock the config
vi.mock('../config/index.js', () => ({
  config: {
    aws: {
      s3: {
        bucket: 'test-bucket',
      },
    },
    upload: {
      maxSizeMB: 10,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      presignedUrlExpiryMinutes: 15,
    },
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

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

const mockGetSignedUrl = vi.mocked(getSignedUrl);

describe('S3Service', () => {
  let s3Service: S3Service;

  beforeEach(() => {
    s3Service = new S3Service();
    vi.clearAllMocks();
    
    // Mock Date.now() for consistent timestamps
    const mockDate = new Date('2024-01-15T10:30:00.000Z');
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validateFile', () => {
    it('should pass validation for valid JPEG file', () => {
      expect(() => {
        s3Service.validateFile('image/jpeg', 5 * 1024 * 1024); // 5MB
      }).not.toThrow();
    });

    it('should pass validation for valid PNG file', () => {
      expect(() => {
        s3Service.validateFile('image/png', 2 * 1024 * 1024); // 2MB
      }).not.toThrow();
    });

    it('should pass validation for valid WebP file', () => {
      expect(() => {
        s3Service.validateFile('image/webp', 1 * 1024 * 1024); // 1MB
      }).not.toThrow();
    });

    it('should throw error for invalid file type', () => {
      expect(() => {
        s3Service.validateFile('image/gif', 1024);
      }).toThrow('Invalid file type');
    });

    it('should throw error for non-image file type', () => {
      expect(() => {
        s3Service.validateFile('text/plain', 1024);
      }).toThrow('Invalid file type');
    });

    it('should throw error for file size exceeding limit', () => {
      const oversizeFile = 11 * 1024 * 1024; // 11MB
      expect(() => {
        s3Service.validateFile('image/jpeg', oversizeFile);
      }).toThrow('File size exceeds maximum limit of 10MB');
    });

    it('should throw error for zero file size', () => {
      expect(() => {
        s3Service.validateFile('image/jpeg', 0);
      }).toThrow('File size must be greater than 0');
    });

    it('should throw error for negative file size', () => {
      expect(() => {
        s3Service.validateFile('image/jpeg', -1);
      }).toThrow('File size must be greater than 0');
    });

    it('should throw S3UploadError with correct error codes', () => {
      try {
        s3Service.validateFile('image/gif', 1024);
      } catch (error) {
        const s3Error = error as S3UploadError;
        expect(s3Error.code).toBe('INVALID_FILE_TYPE');
        expect(s3Error.statusCode).toBe(400);
      }

      try {
        s3Service.validateFile('image/jpeg', 11 * 1024 * 1024);
      } catch (error) {
        const s3Error = error as S3UploadError;
        expect(s3Error.code).toBe('FILE_TOO_LARGE');
        expect(s3Error.statusCode).toBe(413);
      }

      try {
        s3Service.validateFile('image/jpeg', 0);
      } catch (error) {
        const s3Error = error as S3UploadError;
        expect(s3Error.code).toBe('INVALID_FILE_SIZE');
        expect(s3Error.statusCode).toBe(400);
      }
    });
  });

  describe('generateS3Key', () => {
    it('should generate key with correct format', () => {
      const fileName = 'test-image.jpg';
      const key = s3Service.generateS3Key(fileName);
      
      expect(key).toBe('uploads/2024-01-15/test-uuid-1234.jpg');
    });

    it('should handle file without extension', () => {
      const fileName = 'test-image';
      const key = s3Service.generateS3Key(fileName);
      
      expect(key).toBe('uploads/2024-01-15/test-uuid-1234.jpg');
    });

    it('should extract correct extension from filename', () => {
      const fileName = 'my-photo.png';
      const key = s3Service.generateS3Key(fileName);
      
      expect(key).toBe('uploads/2024-01-15/test-uuid-1234.png');
    });

    it('should handle complex filename with multiple dots', () => {
      const fileName = 'my.test.image.webp';
      const key = s3Service.generateS3Key(fileName);
      
      expect(key).toBe('uploads/2024-01-15/test-uuid-1234.webp');
    });
  });

  describe('generatePresignedUploadUrl', () => {
    const validRequest = {
      fileName: 'test.jpg',
      fileType: 'image/jpeg',
      fileSize: 1024 * 1024, // 1MB
    };

    it('should generate presigned URL successfully', async () => {
      const mockUrl = 'https://test-bucket.s3.amazonaws.com/presigned-url';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const result = await s3Service.generatePresignedUploadUrl(validRequest);

      expect(result).toEqual({
        uploadUrl: mockUrl,
        key: 'uploads/2024-01-15/test-uuid-1234.jpg',
        expiresIn: 900, // 15 minutes in seconds
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), // s3Client
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'uploads/2024-01-15/test-uuid-1234.jpg',
            ContentType: 'image/jpeg',
            ContentLength: 1024 * 1024,
          }),
        }),
        { expiresIn: 900 }
      );
    });

    it('should throw validation error for invalid file type', async () => {
      const invalidRequest = {
        ...validRequest,
        fileType: 'image/gif',
      };

      await expect(
        s3Service.generatePresignedUploadUrl(invalidRequest)
      ).rejects.toThrow('Invalid file type');
    });

    it('should throw validation error for oversized file', async () => {
      const invalidRequest = {
        ...validRequest,
        fileSize: 11 * 1024 * 1024, // 11MB
      };

      await expect(
        s3Service.generatePresignedUploadUrl(invalidRequest)
      ).rejects.toThrow('File size exceeds maximum limit');
    });

    it('should handle AWS SDK errors', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('AWS SDK Error'));

      await expect(
        s3Service.generatePresignedUploadUrl(validRequest)
      ).rejects.toThrow('Failed to generate upload URL');
    });

    it('should wrap AWS errors with correct error code', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('AWS SDK Error'));

      try {
        await s3Service.generatePresignedUploadUrl(validRequest);
      } catch (error) {
        const s3Error = error as S3UploadError;
        expect(s3Error.code).toBe('S3_OPERATION_FAILED');
        expect(s3Error.statusCode).toBe(500);
      }
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should generate download URL successfully', async () => {
      const mockUrl = 'https://test-bucket.s3.amazonaws.com/download-url';
      const testKey = 'uploads/2024-01-15/test-uuid-1234.jpg';
      
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const result = await s3Service.generatePresignedDownloadUrl(testKey);

      expect(result).toBe(mockUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object), // s3Client
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: testKey,
          }),
        }),
        { expiresIn: 3600 }
      );
    });

    it('should use custom expiry time', async () => {
      const mockUrl = 'https://test-bucket.s3.amazonaws.com/download-url';
      const testKey = 'uploads/2024-01-15/test-uuid-1234.jpg';
      const customExpiry = 7200; // 2 hours
      
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      await s3Service.generatePresignedDownloadUrl(testKey, customExpiry);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: customExpiry }
      );
    });

    it('should handle AWS SDK errors for download URL', async () => {
      const testKey = 'uploads/2024-01-15/test-uuid-1234.jpg';
      mockGetSignedUrl.mockRejectedValue(new Error('AWS SDK Error'));

      await expect(
        s3Service.generatePresignedDownloadUrl(testKey)
      ).rejects.toThrow('Failed to generate download URL');
    });

    it('should wrap download errors with correct error code', async () => {
      const testKey = 'uploads/2024-01-15/test-uuid-1234.jpg';
      mockGetSignedUrl.mockRejectedValue(new Error('AWS SDK Error'));

      try {
        await s3Service.generatePresignedDownloadUrl(testKey);
      } catch (error) {
        const s3Error = error as S3UploadError;
        expect(s3Error.code).toBe('S3_OPERATION_FAILED');
        expect(s3Error.statusCode).toBe(500);
      }
    });
  });
});