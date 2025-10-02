import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThemeUploadManager, ThemeUploadConfig } from './themeUpload.js';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner');
vi.mock('sharp');

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    aws: {
      region: 'us-east-1',
      s3: {
        bucketName: 'test-bucket'
      }
    }
  }
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

describe('ThemeUploadManager', () => {
  let uploadManager: ThemeUploadManager;
  let mockS3Client: any;
  let mockSharp: any;
  let config: ThemeUploadConfig;

  beforeEach(() => {
    config = {
      bucketName: 'test-bucket',
      region: 'us-east-1',
      themePrefix: 'themes',
      maxFileSize: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      thumbnailSize: { width: 300, height: 400 }
    };

    mockS3Client = {
      send: vi.fn()
    };

    mockSharp = {
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      png: vi.fn().mockReturnThis(),
      grayscale: vi.fn().mockReturnThis(),
      toBuffer: vi.fn(),
      metadata: vi.fn()
    };

    vi.mocked(S3Client).mockImplementation(() => mockS3Client);
    vi.mocked(sharp).mockImplementation(() => mockSharp);
    vi.mocked(getSignedUrl).mockResolvedValue('https://signed-url.com');

    uploadManager = new ThemeUploadManager(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateUploadUrl', () => {
    it('should generate upload URL for valid file type', async () => {
      const result = await uploadManager.generateUploadUrl(
        'template.jpg',
        'image/jpeg',
        'barbarian',
        'template'
      );

      expect(result).toEqual({
        uploadUrl: 'https://signed-url.com',
        key: 'themes/barbarian/template/test-uuid-123.jpg'
      });

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        { expiresIn: 900 }
      );
    });

    it('should reject unsupported file types', async () => {
      await expect(
        uploadManager.generateUploadUrl(
          'template.gif',
          'image/gif',
          'barbarian',
          'template'
        )
      ).rejects.toThrow('Unsupported file type: image/gif');
    });

    it('should handle different asset types', async () => {
      await uploadManager.generateUploadUrl(
        'mask.png',
        'image/png',
        'barbarian',
        'mask'
      );

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        { expiresIn: 900 }
      );
    });
  });

  describe('processTemplateImage', () => {
    beforeEach(() => {
      // Mock S3 download
      mockS3Client.send.mockResolvedValue({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from('mock-image-data');
          }
        }
      });

      // Mock Sharp processing
      mockSharp.toBuffer.mockResolvedValue(Buffer.from('processed-image'));
    });

    it('should process template image and generate thumbnail', async () => {
      const result = await uploadManager.processTemplateImage(
        'source-key',
        'barbarian',
        'warrior'
      );

      expect(result).toEqual({
        templateUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/themes/barbarian/templates/warrior-template.jpg',
        thumbnailUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/themes/barbarian/thumbnails/warrior-thumb.jpg'
      });

      // Verify Sharp was called for thumbnail generation
      expect(mockSharp.resize).toHaveBeenCalledWith(300, 400, {
        fit: 'cover',
        position: 'center'
      });

      // Verify S3 uploads
      expect(mockS3Client.send).toHaveBeenCalledTimes(3); // 1 download + 2 uploads
    });

    it('should handle processing errors gracefully', async () => {
      mockS3Client.send.mockRejectedValueOnce(new Error('S3 error'));

      await expect(
        uploadManager.processTemplateImage('source-key', 'barbarian', 'warrior')
      ).rejects.toThrow('S3 error');
    });
  });

  describe('processBlendingMask', () => {
    beforeEach(() => {
      // Mock S3 download
      mockS3Client.send.mockResolvedValue({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from('mock-mask-data');
          }
        }
      });

      // Mock Sharp processing
      mockSharp.toBuffer.mockResolvedValue(Buffer.from('processed-mask'));
    });

    it('should process blending mask to grayscale PNG', async () => {
      const result = await uploadManager.processBlendingMask(
        'source-key',
        'barbarian',
        'warrior'
      );

      expect(result).toBe(
        'https://test-bucket.s3.us-east-1.amazonaws.com/themes/barbarian/masks/warrior-mask.png'
      );

      // Verify Sharp was called for grayscale conversion
      expect(mockSharp.grayscale).toHaveBeenCalled();
      expect(mockSharp.png).toHaveBeenCalledWith({ compressionLevel: 9 });

      // Verify S3 upload
      expect(mockS3Client.send).toHaveBeenCalledTimes(2); // 1 download + 1 upload
    });
  });

  describe('validateImage', () => {
    beforeEach(() => {
      // Mock S3 download
      mockS3Client.send.mockResolvedValue({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from('mock-image-data');
          }
        }
      });
    });

    it('should validate valid image', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg'
      });

      const result = await uploadManager.validateImage('test-key');

      expect(result).toEqual({
        isValid: true,
        dimensions: { width: 1920, height: 1080 },
        size: 15, // Buffer.from('mock-image-data').length
        format: 'jpeg'
      });
    });

    it('should reject invalid image format', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'gif'
      });

      const result = await uploadManager.validateImage('test-key');

      expect(result.isValid).toBe(false);
    });

    it('should handle validation errors', async () => {
      mockSharp.metadata.mockRejectedValue(new Error('Invalid image'));

      const result = await uploadManager.validateImage('test-key');

      expect(result).toEqual({
        isValid: false,
        error: 'Invalid image'
      });
    });

    it('should reject images without dimensions', async () => {
      mockSharp.metadata.mockResolvedValue({
        format: 'jpeg'
        // Missing width and height
      });

      const result = await uploadManager.validateImage('test-key');

      expect(result.isValid).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle S3 client errors', async () => {
      vi.mocked(getSignedUrl).mockRejectedValue(new Error('S3 error'));

      await expect(
        uploadManager.generateUploadUrl(
          'template.jpg',
          'image/jpeg',
          'barbarian',
          'template'
        )
      ).rejects.toThrow('S3 error');
    });

    it('should handle Sharp processing errors', async () => {
      mockS3Client.send.mockResolvedValue({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from('mock-image-data');
          }
        }
      });

      mockSharp.toBuffer.mockRejectedValue(new Error('Sharp error'));

      await expect(
        uploadManager.processTemplateImage('source-key', 'barbarian', 'warrior')
      ).rejects.toThrow('Sharp error');
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customConfig: ThemeUploadConfig = {
        bucketName: 'custom-bucket',
        region: 'eu-west-1',
        themePrefix: 'custom-themes',
        maxFileSize: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/png'],
        thumbnailSize: { width: 200, height: 300 }
      };

      const customManager = new ThemeUploadManager(customConfig);
      expect(customManager).toBeInstanceOf(ThemeUploadManager);
    });

    it('should handle file extensions correctly', async () => {
      await uploadManager.generateUploadUrl(
        'template.jpeg',
        'image/jpeg',
        'barbarian',
        'template'
      );

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        { expiresIn: 900 }
      );
    });

    it('should handle files without extensions', async () => {
      await uploadManager.generateUploadUrl(
        'template',
        'image/jpeg',
        'barbarian',
        'template'
      );

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(Object),
        { expiresIn: 900 }
      );
    });
  });
});