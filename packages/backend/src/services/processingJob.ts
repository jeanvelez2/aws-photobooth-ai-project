import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDBDocClient } from './aws.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ProcessingJob, ProcessingRequest } from 'shared';

export class ProcessingJobService {
  private tableName = config.aws.dynamodb.processingJobsTable;

  constructor() {
    console.log(`ProcessingJobService using table: ${this.tableName}`);
  }

  /**
   * Create a new processing job
   */
  async createJob(request: ProcessingRequest): Promise<ProcessingJob> {
    const jobId = uuidv4();
    const now = new Date();
    
    const job: ProcessingJob = {
      jobId: jobId, // DynamoDB partition key
      userId: request.userId,
      originalImageUrl: request.originalImageUrl,
      themeId: request.themeId,
      variantId: request.variantId,
      status: 'queued',
      createdAt: now.toISOString(),
      retryCount: 0,
      outputFormat: request.outputFormat,
    };

    try {
      console.log(`Creating job ${jobId} in table ${this.tableName}`);
      await dynamoDBDocClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            ...job,
            // Add TTL (7 days from creation)
            ttl: Math.floor((now.getTime() + 7 * 24 * 60 * 60 * 1000) / 1000),
          },
        })
      );

      console.log(`Job ${jobId} created successfully in ${this.tableName}`);
      logger.info('Processing job created', { jobId, themeId: request.themeId });
      return job;
    } catch (error) {
      console.log(`Failed to create job ${jobId}: ${error}`);
      logger.error('Failed to create processing job', { error, jobId });
      throw new Error('Failed to create processing job');
    }
  }

  /**
   * Get a processing job by ID
   */
  async getJob(jobId: string): Promise<ProcessingJob | null> {
    try {
      const result = await dynamoDBDocClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { jobId: jobId },
        })
      );

      if (!result.Item) {
        return null;
      }

      // Remove TTL field from response
      const { ttl, ...job } = result.Item;
      return job as ProcessingJob;
    } catch (error) {
      logger.error('Failed to get processing job', { error, jobId });
      throw new Error('Failed to retrieve processing job');
    }
  }

  /**
   * Update job status and related fields
   */
  async updateJobStatus(
    jobId: string,
    status: ProcessingJob['status'],
    updates: Partial<Pick<ProcessingJob, 'resultImageUrl' | 'error' | 'processingTimeMs'>> = {}
  ): Promise<void> {
    const now = new Date();
    const updateExpression: string[] = ['#status = :status', '#updatedAt = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
    };
    const expressionAttributeValues: Record<string, any> = {
      ':status': status,
      ':updatedAt': now,
    };

    // Add completedAt for completed/failed status
    if (status === 'completed' || status === 'failed') {
      updateExpression.push('#completedAt = :completedAt');
      expressionAttributeNames['#completedAt'] = 'completedAt';
      expressionAttributeValues[':completedAt'] = now;
    }

    // Add optional updates
    if (updates.resultImageUrl) {
      updateExpression.push('#resultImageUrl = :resultImageUrl');
      expressionAttributeNames['#resultImageUrl'] = 'resultImageUrl';
      expressionAttributeValues[':resultImageUrl'] = updates.resultImageUrl;
    }

    if (updates.error) {
      updateExpression.push('#error = :error');
      expressionAttributeNames['#error'] = 'error';
      expressionAttributeValues[':error'] = updates.error;
    }

    if (updates.processingTimeMs) {
      updateExpression.push('#processingTimeMs = :processingTimeMs');
      expressionAttributeNames['#processingTimeMs'] = 'processingTimeMs';
      expressionAttributeValues[':processingTimeMs'] = updates.processingTimeMs;
    }

    try {
      await dynamoDBDocClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { jobId: jobId },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        })
      );

      logger.info('Processing job status updated', { jobId, status, updates });
    } catch (error) {
      logger.error('Failed to update processing job status', { error, jobId, status });
      throw new Error('Failed to update processing job status');
    }
  }

  /**
   * Increment retry count for a job
   */
  async incrementRetryCount(jobId: string): Promise<number> {
    try {
      const result = await dynamoDBDocClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { jobId: jobId },
          UpdateExpression: 'ADD #retryCount :increment',
          ExpressionAttributeNames: {
            '#retryCount': 'retryCount',
          },
          ExpressionAttributeValues: {
            ':increment': 1,
          },
          ReturnValues: 'UPDATED_NEW',
        })
      );

      const newRetryCount = result.Attributes?.retryCount as number;
      logger.info('Processing job retry count incremented', { jobId, retryCount: newRetryCount });
      return newRetryCount;
    } catch (error) {
      logger.error('Failed to increment retry count', { error, jobId });
      throw new Error('Failed to increment retry count');
    }
  }

  /**
   * Get jobs by status (for monitoring and cleanup)
   */
  async getJobsByStatus(status: ProcessingJob['status'], limit = 50): Promise<ProcessingJob[]> {
    try {
      const result = await dynamoDBDocClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'status-createdAt-index',
          KeyConditionExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': status,
          },
          Limit: limit,
          ScanIndexForward: false, // Most recent first
        })
      );

      return (result.Items || []).map(item => {
        const { ttl, ...job } = item;
        return job as ProcessingJob;
      });
    } catch (error) {
      logger.error('Failed to get jobs by status', { error, status });
      throw new Error('Failed to retrieve jobs by status');
    }
  }

  /**
   * Delete a processing job (for cleanup)
   */
  async deleteJob(jobId: string): Promise<void> {
    try {
      await dynamoDBDocClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { jobId: jobId },
        })
      );

      logger.info('Processing job deleted', { jobId });
    } catch (error) {
      logger.error('Failed to delete processing job', { error, jobId });
      throw new Error('Failed to delete processing job');
    }
  }

  /**
   * Get the next queued job for processing
   */
  async getNextQueuedJob(): Promise<ProcessingJob | null> {
    try {
      console.log(`Querying ${this.tableName} for queued jobs using GSI`);
      const result = await dynamoDBDocClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'status-createdAt-index',
          KeyConditionExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'queued',
          },
          Limit: 1,
          ScanIndexForward: true, // Oldest first (FIFO)
        })
      );

      console.log(`GSI query returned ${result.Items?.length || 0} items`);
      if (!result.Items || result.Items.length === 0) {
        // Try fallback: scan table directly for queued jobs
        console.log('GSI returned 0 items, trying direct scan fallback');
        const scanResult = await dynamoDBDocClient.send(
          new QueryCommand({
            TableName: this.tableName,
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': 'queued',
            },
            Limit: 1,
          })
        );
        console.log(`Direct scan returned ${scanResult.Items?.length || 0} items`);
        if (!scanResult.Items || scanResult.Items.length === 0) {
          return null;
        }
        const scanItem = scanResult.Items[0];
        const { ttl, ...scanJob } = scanItem as any;
        return scanJob as ProcessingJob;
      }

      const item = result.Items[0];
      if (!item) {
        return null;
      }
      const { ttl, ...job } = item as any;
      return job as ProcessingJob;
    } catch (error) {
      console.log(`GSI query failed: ${error}`);
      logger.error('Failed to get next queued job', { error });
      throw new Error('Failed to retrieve next queued job');
    }
  }

  /**
   * Get a job by ID (alias for getJob for consistency)
   */
  async getJobById(jobId: string): Promise<ProcessingJob | null> {
    return this.getJob(jobId);
  }

  /**
   * Complete a job with result URL and processing time
   */
  async completeJob(jobId: string, resultImageUrl: string, processingTimeMs: number): Promise<void> {
    await this.updateJobStatus(jobId, 'completed', {
      resultImageUrl,
      processingTimeMs,
    });
  }

  /**
   * Fail a job with error message
   */
  async failJob(jobId: string, errorMessage: string): Promise<void> {
    await this.updateJobStatus(jobId, 'failed', {
      error: errorMessage,
    });
  }

  /**
   * Retry a job by incrementing retry count and setting status back to queued
   */
  async retryJob(jobId: string): Promise<void> {
    await this.incrementRetryCount(jobId);
    await this.updateJobStatus(jobId, 'queued');
  }

  /**
   * Get jobs that are stuck in processing state (for cleanup)
   */
  async getStuckJobs(olderThanMinutes = 30): Promise<ProcessingJob[]> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    try {
      // First get all processing jobs
      const result = await dynamoDBDocClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'status-createdAt-index',
          KeyConditionExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': 'processing',
          },
        })
      );

      // Filter by cutoff time in application code
      const stuckJobs = (result.Items || [])
        .map(item => {
          const { ttl, ...job } = item;
          return job as ProcessingJob;
        })
        .filter(job => new Date(job.createdAt) < cutoffTime);

      return stuckJobs;
    } catch (error) {
      logger.error('Failed to get stuck jobs', { error });
      return []; // Return empty array instead of throwing to prevent startup failures
    }
  }
}

// Export singleton instance
export const processingJobService = new ProcessingJobService();