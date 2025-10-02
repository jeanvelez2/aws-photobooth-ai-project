import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProcessingJobService } from './processingJob.js';
import { ProcessingRequest, ProcessingJob } from 'shared';

// Mock AWS SDK
vi.mock('./aws.js', () => ({
  dynamoDBDocClient: {
    send: vi.fn(),
  },
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    aws: {
      dynamodb: {
        processingJobsTable: 'test-processing-jobs',
      },
    },
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

describe('ProcessingJobService', () => {
  let service: ProcessingJobService;
  let mockDynamoDBClient: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Get mocked DynamoDB client
    const { dynamoDBDocClient } = await import('./aws.js');
    mockDynamoDBClient = dynamoDBDocClient;
    
    // Create service instance
    service = new ProcessingJobService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createJob', () => {
    it('should create a new processing job successfully', async () => {
      // Arrange
      const request: ProcessingRequest = {
        photoId: 'photo-123',
        themeId: 'theme-456',
        variantId: 'variant-789',
        outputFormat: 'jpeg',
        userId: 'user-123',
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockDynamoDBClient.send.mockResolvedValueOnce({});

      // Act
      const result = await service.createJob(request);

      // Assert
      expect(result).toMatchObject({
        userId: 'user-123',
        originalImageUrl: 'https://example.com/image.jpg',
        themeId: 'theme-456',
        variantId: 'variant-789',
        status: 'queued',
        retryCount: 0,
        outputFormat: 'jpeg',
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(mockDynamoDBClient.send).toHaveBeenCalledOnce();
    });

    it('should handle DynamoDB errors', async () => {
      // Arrange
      const request: ProcessingRequest = {
        photoId: 'photo-123',
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockDynamoDBClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      // Act & Assert
      await expect(service.createJob(request)).rejects.toThrow('Failed to create processing job');
    });
  });

  describe('getJob', () => {
    it('should retrieve a job successfully', async () => {
      // Arrange
      const jobId = 'job-123';
      const mockJob = {
        id: jobId,
        status: 'completed',
        themeId: 'theme-456',
        ttl: 1234567890,
      };

      mockDynamoDBClient.send.mockResolvedValueOnce({
        Item: mockJob,
      });

      // Act
      const result = await service.getJob(jobId);

      // Assert
      expect(result).toEqual({
        id: jobId,
        status: 'completed',
        themeId: 'theme-456',
      });
      expect(result).not.toHaveProperty('ttl');
    });

    it('should return null for non-existent job', async () => {
      // Arrange
      const jobId = 'non-existent-job';
      mockDynamoDBClient.send.mockResolvedValueOnce({});

      // Act
      const result = await service.getJob(jobId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle DynamoDB errors', async () => {
      // Arrange
      const jobId = 'job-123';
      mockDynamoDBClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      // Act & Assert
      await expect(service.getJob(jobId)).rejects.toThrow('Failed to retrieve processing job');
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status to completed with result URL', async () => {
      // Arrange
      const jobId = 'job-123';
      const status = 'completed';
      const updates = {
        resultImageUrl: 'https://example.com/result.jpg',
        processingTimeMs: 5000,
      };

      mockDynamoDBClient.send.mockResolvedValueOnce({});

      // Act
      await service.updateJobStatus(jobId, status, updates);

      // Assert
      expect(mockDynamoDBClient.send).toHaveBeenCalledOnce();
      const call = mockDynamoDBClient.send.mock.calls[0][0];
      expect(call.input.UpdateExpression).toContain('#status = :status');
      expect(call.input.UpdateExpression).toContain('#completedAt = :completedAt');
      expect(call.input.UpdateExpression).toContain('#resultImageUrl = :resultImageUrl');
      expect(call.input.UpdateExpression).toContain('#processingTimeMs = :processingTimeMs');
    });

    it('should update job status to failed with error message', async () => {
      // Arrange
      const jobId = 'job-123';
      const status = 'failed';
      const updates = {
        error: 'Processing failed due to invalid image',
      };

      mockDynamoDBClient.send.mockResolvedValueOnce({});

      // Act
      await service.updateJobStatus(jobId, status, updates);

      // Assert
      expect(mockDynamoDBClient.send).toHaveBeenCalledOnce();
      const call = mockDynamoDBClient.send.mock.calls[0][0];
      expect(call.input.UpdateExpression).toContain('#error = :error');
      expect(call.input.ExpressionAttributeValues[':error']).toBe('Processing failed due to invalid image');
    });

    it('should handle DynamoDB errors', async () => {
      // Arrange
      const jobId = 'job-123';
      mockDynamoDBClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      // Act & Assert
      await expect(service.updateJobStatus(jobId, 'failed')).rejects.toThrow('Failed to update processing job status');
    });
  });

  describe('incrementRetryCount', () => {
    it('should increment retry count and return new value', async () => {
      // Arrange
      const jobId = 'job-123';
      mockDynamoDBClient.send.mockResolvedValueOnce({
        Attributes: { retryCount: 2 },
      });

      // Act
      const result = await service.incrementRetryCount(jobId);

      // Assert
      expect(result).toBe(2);
      expect(mockDynamoDBClient.send).toHaveBeenCalledOnce();
    });

    it('should handle DynamoDB errors', async () => {
      // Arrange
      const jobId = 'job-123';
      mockDynamoDBClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      // Act & Assert
      await expect(service.incrementRetryCount(jobId)).rejects.toThrow('Failed to increment retry count');
    });
  });

  describe('getJobsByStatus', () => {
    it('should retrieve jobs by status', async () => {
      // Arrange
      const status = 'processing';
      const mockJobs = [
        { id: 'job-1', status: 'processing', ttl: 123 },
        { id: 'job-2', status: 'processing', ttl: 456 },
      ];

      mockDynamoDBClient.send.mockResolvedValueOnce({
        Items: mockJobs,
      });

      // Act
      const result = await service.getJobsByStatus(status);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'job-1', status: 'processing' });
      expect(result[1]).toEqual({ id: 'job-2', status: 'processing' });
      expect(result[0]).not.toHaveProperty('ttl');
    });

    it('should handle empty results', async () => {
      // Arrange
      const status = 'completed';
      mockDynamoDBClient.send.mockResolvedValueOnce({});

      // Act
      const result = await service.getJobsByStatus(status);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle DynamoDB errors', async () => {
      // Arrange
      const status = 'failed';
      mockDynamoDBClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      // Act & Assert
      await expect(service.getJobsByStatus(status)).rejects.toThrow('Failed to retrieve jobs by status');
    });
  });

  describe('deleteJob', () => {
    it('should delete a job successfully', async () => {
      // Arrange
      const jobId = 'job-123';
      mockDynamoDBClient.send.mockResolvedValueOnce({});

      // Act
      await service.deleteJob(jobId);

      // Assert
      expect(mockDynamoDBClient.send).toHaveBeenCalledOnce();
    });

    it('should handle DynamoDB errors', async () => {
      // Arrange
      const jobId = 'job-123';
      mockDynamoDBClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      // Act & Assert
      await expect(service.deleteJob(jobId)).rejects.toThrow('Failed to delete processing job');
    });
  });

  describe('getStuckJobs', () => {
    it('should retrieve stuck jobs older than specified time', async () => {
      // Arrange
      const olderThanMinutes = 30;
      const mockStuckJobs = [
        { id: 'stuck-job-1', status: 'processing', createdAt: new Date(Date.now() - 45 * 60 * 1000) },
      ];

      mockDynamoDBClient.send.mockResolvedValueOnce({
        Items: mockStuckJobs,
      });

      // Act
      const result = await service.getStuckJobs(olderThanMinutes);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('stuck-job-1');
      expect(mockDynamoDBClient.send).toHaveBeenCalledOnce();
    });

    it('should handle DynamoDB errors', async () => {
      // Arrange
      mockDynamoDBClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));

      // Act & Assert
      await expect(service.getStuckJobs()).rejects.toThrow('Failed to retrieve stuck jobs');
    });
  });
});