import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobQueue } from './jobQueue.js';
import { ProcessingRequest } from 'shared';

// Mock processing job service
vi.mock('./processingJob.js', () => ({
  processingJobService: {
    createJob: vi.fn(),
    getJob: vi.fn(),
    updateJobStatus: vi.fn(),
    incrementRetryCount: vi.fn(),
    getJobsByStatus: vi.fn(),
  },
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    processing: {
      maxRetries: 3,
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

describe('JobQueue', () => {
  let jobQueue: JobQueue;
  let mockProcessingJobService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked service
    const { processingJobService } = await import('./processingJob.js');
    mockProcessingJobService = processingJobService;
    
    jobQueue = new JobQueue({
      maxRetries: 3,
      baseDelayMs: 100, // Shorter delays for testing
      maxDelayMs: 1000,
    });
  });

  afterEach(() => {
    jobQueue.shutdown();
  });

  describe('enqueueJob', () => {
    it('should create and enqueue a job successfully', async () => {
      // Arrange
      const request: ProcessingRequest = {
        photoId: 'photo-123',
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        originalImageUrl: 'https://example.com/image.jpg',
      };

      const mockJob = {
        id: 'job-123',
        status: 'queued' as const,
        themeId: 'theme-456',
        createdAt: new Date(),
        retryCount: 0,
        outputFormat: 'jpeg' as const,
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockProcessingJobService.createJob.mockResolvedValueOnce(mockJob);

      // Act
      const result = await jobQueue.enqueueJob(request);

      // Assert
      expect(result).toEqual(mockJob);
      expect(mockProcessingJobService.createJob).toHaveBeenCalledWith(request);
    });

    it('should handle job creation errors', async () => {
      // Arrange
      const request: ProcessingRequest = {
        photoId: 'photo-123',
        themeId: 'theme-456',
        outputFormat: 'jpeg',
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockProcessingJobService.createJob.mockRejectedValueOnce(new Error('Creation failed'));

      // Act & Assert
      await expect(jobQueue.enqueueJob(request)).rejects.toThrow('Creation failed');
    });
  });

  describe('getJobStatus', () => {
    it('should retrieve job status', async () => {
      // Arrange
      const jobId = 'job-123';
      const mockJob = {
        id: jobId,
        status: 'completed' as const,
        themeId: 'theme-456',
        createdAt: new Date(),
        retryCount: 0,
        outputFormat: 'jpeg' as const,
        originalImageUrl: 'https://example.com/image.jpg',
      };

      mockProcessingJobService.getJob.mockResolvedValueOnce(mockJob);

      // Act
      const result = await jobQueue.getJobStatus(jobId);

      // Assert
      expect(result).toEqual(mockJob);
      expect(mockProcessingJobService.getJob).toHaveBeenCalledWith(jobId);
    });

    it('should return null for non-existent job', async () => {
      // Arrange
      const jobId = 'non-existent';
      mockProcessingJobService.getJob.mockResolvedValueOnce(null);

      // Act
      const result = await jobQueue.getJobStatus(jobId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      // Arrange
      mockProcessingJobService.getJobsByStatus
        .mockResolvedValueOnce([{ id: '1' }, { id: '2' }]) // queued: 2
        .mockResolvedValueOnce([{ id: '3' }]) // processing: 1
        .mockResolvedValueOnce([{ id: '4' }, { id: '5' }, { id: '6' }]) // completed: 3
        .mockResolvedValueOnce([{ id: '7' }]); // failed: 1

      // Act
      const result = await jobQueue.getQueueStats();

      // Assert
      expect(result).toEqual({
        queued: 2,
        processing: 1,
        completed: 3,
        failed: 1,
      });
    });

    it('should handle errors when getting stats', async () => {
      // Arrange
      mockProcessingJobService.getJobsByStatus.mockRejectedValueOnce(new Error('Stats error'));

      // Act & Assert
      await expect(jobQueue.getQueueStats()).rejects.toThrow('Stats error');
    });
  });

  describe('retry logic', () => {
    it('should calculate exponential backoff delay correctly', () => {
      // Test the private method through reflection
      const queue = new JobQueue({ baseDelayMs: 1000, maxDelayMs: 30000 });
      
      // Access private method for testing
      const calculateRetryDelay = (queue as any).calculateRetryDelay.bind(queue);
      
      // Test exponential backoff (without jitter for predictable testing)
      const delay1 = calculateRetryDelay(1); // Should be around 1000ms
      const delay2 = calculateRetryDelay(2); // Should be around 2000ms
      const delay3 = calculateRetryDelay(3); // Should be around 4000ms
      
      expect(delay1).toBeGreaterThan(500);
      expect(delay1).toBeLessThan(1500);
      expect(delay2).toBeGreaterThan(1500);
      expect(delay2).toBeLessThan(2500);
      expect(delay3).toBeGreaterThan(3000);
      expect(delay3).toBeLessThan(5000);
    });

    it('should cap delay at maximum value', () => {
      const queue = new JobQueue({ baseDelayMs: 1000, maxDelayMs: 5000 });
      const calculateRetryDelay = (queue as any).calculateRetryDelay.bind(queue);
      
      // High retry count should be capped at maxDelayMs
      const delay = calculateRetryDelay(10);
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('shutdown', () => {
    it('should clear all pending retries on shutdown', () => {
      // Arrange
      const queue = new JobQueue();
      
      // Simulate some pending retries
      (queue as any).retryTimeouts.set('job-1', setTimeout(() => {}, 1000));
      (queue as any).retryTimeouts.set('job-2', setTimeout(() => {}, 2000));
      
      expect((queue as any).retryTimeouts.size).toBe(2);

      // Act
      queue.shutdown();

      // Assert
      expect((queue as any).retryTimeouts.size).toBe(0);
    });
  });

  describe('cancelJobRetry', () => {
    it('should cancel scheduled retry', async () => {
      // Arrange
      const jobId = 'job-123';
      const timeoutId = setTimeout(() => {}, 1000);
      (jobQueue as any).retryTimeouts.set(jobId, timeoutId);

      // Act
      await jobQueue.cancelJobRetry(jobId);

      // Assert
      expect((jobQueue as any).retryTimeouts.has(jobId)).toBe(false);
    });

    it('should handle cancelling non-existent retry', async () => {
      // Arrange
      const jobId = 'non-existent';

      // Act & Assert - should not throw
      await expect(jobQueue.cancelJobRetry(jobId)).resolves.toBeUndefined();
    });
  });
});