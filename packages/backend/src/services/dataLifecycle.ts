import { ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { ScanCommand, DeleteItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDBDocClient, s3Client } from './aws.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { processingJobService } from './processingJob.js';

export interface DataRetentionPolicy {
  uploads: number; // days
  processed: number; // days
  jobs: number; // days
  auditLogs: number; // days
}

export interface CleanupResult {
  deletedUploads: number;
  deletedProcessed: number;
  deletedJobs: number;
  deletedAuditLogs: number;
  errors: string[];
}

export class DataLifecycleService {
  private readonly bucketName = config.aws.s3.bucketName;
  private readonly processingJobsTable = config.aws.dynamodb.processingJobsTable;
  private readonly auditLogsTable = 'photobooth-audit-logs';

  private readonly defaultRetentionPolicy: DataRetentionPolicy = {
    uploads: 1, // 24 hours for uploads
    processed: 7, // 7 days for processed images
    jobs: 7, // 7 days for job records
    auditLogs: 90, // 90 days for audit logs (GDPR compliance)
  };

  /**
   * Run automated cleanup based on retention policies
   */
  async runAutomatedCleanup(customPolicy?: Partial<DataRetentionPolicy>): Promise<CleanupResult> {
    const policy = { ...this.defaultRetentionPolicy, ...customPolicy };
    const result: CleanupResult = {
      deletedUploads: 0,
      deletedProcessed: 0,
      deletedJobs: 0,
      deletedAuditLogs: 0,
      errors: [],
    };

    logger.info('Starting automated data cleanup', { policy });

    try {
      // Clean up expired uploads
      result.deletedUploads = await this.cleanupExpiredUploads(policy.uploads);
      
      // Clean up expired processed images
      result.deletedProcessed = await this.cleanupExpiredProcessedImages(policy.processed);
      
      // Clean up old job records
      result.deletedJobs = await this.cleanupExpiredJobs(policy.jobs);
      
      // Clean up old audit logs
      result.deletedAuditLogs = await this.cleanupExpiredAuditLogs(policy.auditLogs);

      logger.info('Automated data cleanup completed', result);
      
      // Log cleanup activity for audit
      await this.auditDataOperation('AUTOMATED_CLEANUP', {
        policy,
        result,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      logger.error('Automated data cleanup failed', { error, policy });
      
      await this.auditDataOperation('CLEANUP_FAILED', {
        policy,
        error: errorMessage,
      });
    }

    return result;
  }

  /**
   * Clean up expired upload files from S3
   */
  private async cleanupExpiredUploads(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    return this.cleanupS3Objects('uploads/', cutoffDate);
  }

  /**
   * Clean up expired processed images from S3
   */
  private async cleanupExpiredProcessedImages(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    return this.cleanupS3Objects('processed/', cutoffDate);
  }

  /**
   * Clean up expired job records from DynamoDB
   */
  private async cleanupExpiredJobs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    try {
      // Get jobs older than cutoff date
      const jobs = await processingJobService.getJobsByStatus('completed', 1000);
      const expiredJobs = jobs.filter(job => new Date(job.createdAt) < cutoffDate);

      // Delete expired jobs
      for (const job of expiredJobs) {
        try {
          await processingJobService.deleteJob(job.jobId);
          deletedCount++;
        } catch (error) {
          logger.error('Failed to delete expired job', { jobId: job.jobId, error });
        }
      }

      // Also clean up failed jobs
      const failedJobs = await processingJobService.getJobsByStatus('failed', 1000);
      const expiredFailedJobs = failedJobs.filter(job => new Date(job.createdAt) < cutoffDate);

      for (const job of expiredFailedJobs) {
        try {
          await processingJobService.deleteJob(job.jobId);
          deletedCount++;
        } catch (error) {
          logger.error('Failed to delete expired failed job', { jobId: job.jobId, error });
        }
      }

      logger.info('Cleaned up expired job records', { deletedCount, retentionDays });
      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired jobs', { error, retentionDays });
      throw error;
    }
  }

  /**
   * Clean up expired audit logs
   */
  private async cleanupExpiredAuditLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    try {
      // Scan for expired audit logs
      const scanResult = await dynamoDBDocClient.send(
        new ScanCommand({
          TableName: this.auditLogsTable,
          FilterExpression: '#timestamp < :cutoffDate',
          ExpressionAttributeNames: {
            '#timestamp': 'timestamp',
          },
          ExpressionAttributeValues: {
            ':cutoffDate': { S: cutoffDate.toISOString() },
          },
        })
      );

      if (scanResult.Items) {
        // Delete expired audit logs in batches
        const batchSize = 25; // DynamoDB batch limit
        for (let i = 0; i < scanResult.Items.length; i += batchSize) {
          const batch = scanResult.Items.slice(i, i + batchSize);
          
          for (const item of batch) {
            try {
              if (item.id?.S) {
                await dynamoDBDocClient.send(
                  new DeleteItemCommand({
                    TableName: this.auditLogsTable,
                    Key: {
                      id: { S: item.id.S },
                    },
                  })
                );
                deletedCount++;
              }
            } catch (error) {
              logger.error('Failed to delete audit log', { logId: item.id?.S, error });
            }
          }
        }
      }

      logger.info('Cleaned up expired audit logs', { deletedCount, retentionDays });
      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired audit logs', { error, retentionDays });
      throw error;
    }
  }

  /**
   * Generic S3 object cleanup by prefix and date
   */
  private async cleanupS3Objects(prefix: string, cutoffDate: Date): Promise<number> {
    let deletedCount = 0;
    let continuationToken: string | undefined;

    try {
      do {
        const listResult = await s3Client.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
          })
        );

        if (listResult.Contents) {
          // Filter objects older than cutoff date
          const expiredObjects = listResult.Contents.filter(
            obj => obj.LastModified && obj.LastModified < cutoffDate
          );

          if (expiredObjects.length > 0) {
            // Delete objects in batches
            const batchSize = 1000; // S3 delete limit
            for (let i = 0; i < expiredObjects.length; i += batchSize) {
              const batch = expiredObjects.slice(i, i + batchSize);
              
              await s3Client.send(
                new DeleteObjectsCommand({
                  Bucket: this.bucketName,
                  Delete: {
                    Objects: batch.map(obj => ({ Key: obj.Key! })),
                    Quiet: true,
                  },
                })
              );
              
              deletedCount += batch.length;
            }
          }
        }

        continuationToken = listResult.NextContinuationToken;
      } while (continuationToken);

      logger.info('Cleaned up S3 objects', { prefix, deletedCount, cutoffDate });
      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup S3 objects', { error, prefix, cutoffDate });
      throw error;
    }
  }

  /**
   * Delete all user data (GDPR right to be forgotten)
   */
  async deleteUserData(userId: string): Promise<void> {
    logger.info('Starting user data deletion', { userId });

    try {
      // Find all jobs for the user
      const userJobs = await this.getUserJobs(userId);
      
      // Delete associated images from S3
      for (const job of userJobs) {
        if (job.originalImageUrl) {
          await this.deleteS3ObjectFromUrl(job.originalImageUrl);
        }
        if (job.resultImageUrl) {
          await this.deleteS3ObjectFromUrl(job.resultImageUrl);
        }
        
        // Delete job record
        await processingJobService.deleteJob(job.id);
      }

      // Audit the deletion
      await this.auditDataOperation('USER_DATA_DELETED', {
        userId,
        deletedJobs: userJobs.length,
      });

      logger.info('User data deletion completed', { userId, deletedJobs: userJobs.length });

    } catch (error) {
      logger.error('Failed to delete user data', { error, userId });
      
      await this.auditDataOperation('USER_DATA_DELETION_FAILED', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }

  /**
   * Get all jobs for a specific user
   */
  private async getUserJobs(userId: string): Promise<any[]> {
    // This would need a GSI on userId in the ProcessingJobs table
    // For now, we'll scan (not efficient for production)
    const scanResult = await dynamoDBDocClient.send(
      new ScanCommand({
        TableName: this.processingJobsTable,
        FilterExpression: '#userId = :userId',
        ExpressionAttributeNames: {
          '#userId': 'userId',
        },
        ExpressionAttributeValues: {
          ':userId': { S: userId },
        },
      })
    );

    return scanResult.Items || [];
  }

  /**
   * Delete S3 object from URL
   */
  private async deleteS3ObjectFromUrl(url: string): Promise<void> {
    try {
      // Extract key from S3 URL
      const urlParts = url.split('/');
      const key = urlParts.slice(3).join('/'); // Remove protocol and bucket parts
      
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: {
            Objects: [{ Key: key }],
            Quiet: true,
          },
        })
      );
    } catch (error) {
      logger.error('Failed to delete S3 object', { error, url });
      // Don't throw - continue with other deletions
    }
  }

  /**
   * Audit data operations for compliance
   */
  async auditDataOperation(operation: string, details: any): Promise<void> {
    try {
      const auditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        operation,
        timestamp: new Date().toISOString(),
        details: JSON.stringify(details),
        ttl: Math.floor((Date.now() + 90 * 24 * 60 * 60 * 1000) / 1000), // 90 days TTL
      };

      await dynamoDBDocClient.send(
        new PutItemCommand({
          TableName: this.auditLogsTable,
          Item: {
            id: { S: auditRecord.id },
            operation: { S: auditRecord.operation },
            timestamp: { S: auditRecord.timestamp },
            details: { S: auditRecord.details },
            ttl: { N: auditRecord.ttl.toString() },
          },
        })
      );

      logger.info('Data operation audited', { operation, auditId: auditRecord.id });

    } catch (error) {
      logger.error('Failed to audit data operation', { error, operation, details });
      // Don't throw - auditing failure shouldn't break the main operation
    }
  }

  /**
   * Get data retention statistics
   */
  async getRetentionStatistics(): Promise<{
    uploads: { count: number; totalSize: number };
    processed: { count: number; totalSize: number };
    jobs: { total: number; byStatus: Record<string, number> };
    auditLogs: { count: number };
  }> {
    const stats = {
      uploads: { count: 0, totalSize: 0 },
      processed: { count: 0, totalSize: 0 },
      jobs: { total: 0, byStatus: {} as Record<string, number> },
      auditLogs: { count: 0 },
    };

    try {
      // Get S3 statistics
      stats.uploads = await this.getS3Statistics('uploads/');
      stats.processed = await this.getS3Statistics('processed/');

      // Get job statistics
      const jobStats = await this.getJobStatistics();
      stats.jobs = jobStats;

      // Get audit log statistics
      stats.auditLogs = await this.getAuditLogStatistics();

      return stats;

    } catch (error) {
      logger.error('Failed to get retention statistics', { error });
      throw error;
    }
  }

  private async getS3Statistics(prefix: string): Promise<{ count: number; totalSize: number }> {
    let count = 0;
    let totalSize = 0;
    let continuationToken: string | undefined;

    do {
      const listResult = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
      );

      if (listResult.Contents) {
        count += listResult.Contents.length;
        totalSize += listResult.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    return { count, totalSize };
  }

  private async getJobStatistics(): Promise<{ total: number; byStatus: Record<string, number> }> {
    const statuses = ['queued', 'processing', 'completed', 'failed'];
    const byStatus: Record<string, number> = {};
    let total = 0;

    for (const status of statuses) {
      const jobs = await processingJobService.getJobsByStatus(status as any, 10000);
      byStatus[status] = jobs.length;
      total += jobs.length;
    }

    return { total, byStatus };
  }

  private async getAuditLogStatistics(): Promise<{ count: number }> {
    try {
      const scanResult = await dynamoDBDocClient.send(
        new ScanCommand({
          TableName: this.auditLogsTable,
          Select: 'COUNT',
        })
      );

      return { count: scanResult.Count || 0 };
    } catch (error) {
      logger.error('Failed to get audit log statistics', { error });
      return { count: 0 };
    }
  }
}

// Export singleton instance
export const dataLifecycleService = new DataLifecycleService();