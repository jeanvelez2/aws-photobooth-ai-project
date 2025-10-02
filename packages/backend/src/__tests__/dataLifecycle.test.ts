import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataLifecycleService } from '../services/dataLifecycle.js';
import { s3Client, dynamoDBDocClient } from '../services/aws.js';
import { processingJobService } from '../services/processingJob.js';

// Mock AWS services
vi.mock('../services/aws.js', () => ({
  s3Client: {
    send: vi.fn(),
  },
  dynamoDBDocClient: {
    send: vi.fn(),
  },
}));

vi.mock('../services/processingJob.js', () => ({
  processingJobService: {
    getJobsByStatus: vi.fn(),
    deleteJob: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('DataLifecycleService', () => {
  let service: DataLifecycleService;

  beforeEach(() => {
    service = new DataLifecycleService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('runAutomatedCleanup', () => {
    it('should run cleanup with default retention policy', async () => {
      // Mock S3 responses
      vi.mocked(s3Client.send).mockResolvedValue({
        Contents: [
          {
            Key: 'uploads/old-file.jpg',
            LastModified: new Date('2023-01-01'),
            Size: 1000,
          },
        ],
      });

      // Mock DynamoDB responses
      vi.mocked(dynamoDBDocClient.send).mockResolvedValue({
        Items: [],
        Count: 0,
      });

      // Mock processing job service
      vi.mocked(processingJobService.getJobsByStatus).mockResolvedValue([]);

      const result = await service.runAutomatedCleanup();

      expect(result).toEqual({
        deletedUploads: expect.any(Number),
        deletedProcessed: expect.any(Number),
        deletedJobs: 0,
        deletedAuditLogs: 0,
        errors: [],
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock S3 to throw error
      vi.mocked(s3Client.send).mockRejectedValue(new Error('S3 error'));

      const result = await service.runAutomatedCleanup();

      expect(result.errors).toContain('S3 error');
    });

    it('should use custom retention policy', async () => {
      const customPolicy = {
        uploads: 2,
        processed: 14,
        jobs: 14,
        auditLogs: 180,
      };

      vi.mocked(s3Client.send).mockResolvedValue({ Contents: [] });
      vi.mocked(dynamoDBDocClient.send).mockResolvedValue({ Items: [], Count: 0 });
      vi.mocked(processingJobService.getJobsByStatus).mockResolvedValue([]);

      const result = await service.runAutomatedCleanup(customPolicy);

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('deleteUserData', () => {
    it('should delete all user data successfully', async () => {
      const userId = 'test-user-123';
      const mockJobs = [
        {
          id: 'job-1',
          userId,
          originalImageUrl: 'https://bucket.s3.amazonaws.com/uploads/image1.jpg',
          resultImageUrl: 'https://bucket.s3.amazonaws.com/processed/result1.jpg',
          createdAt: new Date(),
        },
      ];

      // Mock DynamoDB scan for user jobs
      vi.mocked(dynamoDBDocClient.send).mockResolvedValueOnce({
        Items: mockJobs,
      });

      // Mock S3 delete operations
      vi.mocked(s3Client.send).mockResolvedValue({});

      // Mock job deletion
      vi.mocked(processingJobService.deleteJob).mockResolvedValue();

      // Mock audit log creation
      vi.mocked(dynamoDBDocClient.send).mockResolvedValueOnce({});

      await expect(service.deleteUserData(userId)).resolves.not.toThrow();

      expect(processingJobService.deleteJob).toHaveBeenCalledWith('job-1');
    });

    it('should handle user data deletion errors', async () => {
      const userId = 'test-user-123';

      // Mock DynamoDB to throw error
      vi.mocked(dynamoDBDocClient.send).mockRejectedValue(new Error('DynamoDB error'));

      await expect(service.deleteUserData(userId)).rejects.toThrow('DynamoDB error');
    });
  });

  describe('auditDataOperation', () => {
    it('should create audit log successfully', async () => {
      vi.mocked(dynamoDBDocClient.send).mockResolvedValue({});

      await expect(
        service.auditDataOperation('TEST_OPERATION', { test: 'data' })
      ).resolves.not.toThrow();

      expect(dynamoDBDocClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'photobooth-audit-logs',
            Item: expect.objectContaining({
              operation: { S: 'TEST_OPERATION' },
              details: { S: JSON.stringify({ test: 'data' }) },
            }),
          }),
        })
      );
    });

    it('should handle audit logging errors gracefully', async () => {
      vi.mocked(dynamoDBDocClient.send).mockRejectedValue(new Error('Audit error'));

      // Should not throw even if audit fails
      await expect(
        service.auditDataOperation('TEST_OPERATION', { test: 'data' })
      ).resolves.not.toThrow();
    });
  });

  describe('getRetentionStatistics', () => {
    it('should return comprehensive statistics', async () => {
      // Mock S3 statistics
      vi.mocked(s3Client.send)
        .mockResolvedValueOnce({
          Contents: [
            { Size: 1000 },
            { Size: 2000 },
          ],
        })
        .mockResolvedValueOnce({
          Contents: [
            { Size: 3000 },
          ],
        });

      // Mock job statistics (order: queued, processing, completed, failed)
      vi.mocked(processingJobService.getJobsByStatus)
        .mockResolvedValueOnce([{ id: '4' }]) // queued
        .mockResolvedValueOnce([]) // processing
        .mockResolvedValueOnce([{ id: '1' }, { id: '2' }]) // completed
        .mockResolvedValueOnce([{ id: '3' }]); // failed

      // Mock audit log statistics
      vi.mocked(dynamoDBDocClient.send).mockResolvedValueOnce({
        Count: 50,
      });

      const stats = await service.getRetentionStatistics();

      expect(stats).toEqual({
        uploads: { count: 2, totalSize: 3000 },
        processed: { count: 1, totalSize: 3000 },
        jobs: {
          total: 4,
          byStatus: {
            queued: 1,
            processing: 0,
            completed: 2,
            failed: 1,
          },
        },
        auditLogs: { count: 50 },
      });
    });
  });
});

describe('Data Retention Compliance', () => {
  let service: DataLifecycleService;

  beforeEach(() => {
    service = new DataLifecycleService();
    vi.clearAllMocks();
  });

  it('should enforce GDPR data retention limits', async () => {
    const policy = {
      uploads: 1, // 24 hours
      processed: 7, // 7 days
      jobs: 7, // 7 days
      auditLogs: 90, // 90 days
    };

    // Mock successful cleanup
    vi.mocked(s3Client.send).mockResolvedValue({ Contents: [] });
    vi.mocked(dynamoDBDocClient.send).mockResolvedValue({ Items: [], Count: 0 });
    vi.mocked(processingJobService.getJobsByStatus).mockResolvedValue([]);

    const result = await service.runAutomatedCleanup(policy);

    expect(result.errors).toHaveLength(0);
  });

  it('should handle right to be forgotten requests', async () => {
    const userId = 'gdpr-test-user';

    // Mock user has data
    vi.mocked(dynamoDBDocClient.send).mockResolvedValueOnce({
      Items: [
        {
          id: 'job-1',
          userId,
          originalImageUrl: 'https://bucket.s3.amazonaws.com/uploads/image1.jpg',
        },
      ],
    });

    // Mock successful deletions
    vi.mocked(s3Client.send).mockResolvedValue({});
    vi.mocked(processingJobService.deleteJob).mockResolvedValue();
    vi.mocked(dynamoDBDocClient.send).mockResolvedValueOnce({}); // audit log

    await expect(service.deleteUserData(userId)).resolves.not.toThrow();
  });

  it('should maintain audit trail for compliance', async () => {
    const operation = 'GDPR_DATA_DELETION';
    const details = { userId: 'test-user', reason: 'User request' };

    vi.mocked(dynamoDBDocClient.send).mockResolvedValue({});

    await service.auditDataOperation(operation, details);

    expect(dynamoDBDocClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'photobooth-audit-logs',
          Item: expect.objectContaining({
            operation: { S: operation },
            details: { S: JSON.stringify(details) },
            ttl: { N: expect.any(String) },
          }),
        }),
      })
    );
  });
});