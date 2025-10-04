import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger.js';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const JOBS_TABLE = process.env.JOBS_TABLE || 'photobooth-processing-jobs-dev';
const S3_BUCKET = process.env.S3_BUCKET || 'ai-photobooth-dev';

export class JobCleanupService {
  async cleanupOldJobs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24); // 24 hours ago

    try {
      const result = await docClient.send(new ScanCommand({
        TableName: JOBS_TABLE,
        FilterExpression: 'createdAt < :cutoff',
        ExpressionAttributeValues: {
          ':cutoff': cutoffDate.toISOString()
        }
      }));

      const oldJobs = result.Items || [];
      
      for (const job of oldJobs) {
        await this.cleanupJob(job);
      }

      logger.info(`Cleaned up ${oldJobs.length} old jobs`);
    } catch (error) {
      logger.error('Error cleaning up old jobs:', error);
    }
  }

  private async cleanupJob(job: any): Promise<void> {
    try {
      // Delete result image from S3 if exists
      if (job.resultUrl) {
        const key = this.extractS3Key(job.resultUrl);
        if (key) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: key
          }));
        }
      }

      // Delete job record from DynamoDB
      await docClient.send(new DeleteCommand({
        TableName: JOBS_TABLE,
        Key: { jobId: job.jobId }
      }));

      logger.debug(`Cleaned up job ${job.jobId}`);
    } catch (error) {
      logger.error(`Error cleaning up job ${job.jobId}:`, error);
    }
  }

  private extractS3Key(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch {
      return null;
    }
  }
}