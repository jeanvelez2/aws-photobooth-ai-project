import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ProcessingJob, JobStatus } from 'shared/types/processing.js';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const JOBS_TABLE = process.env.PROCESSING_JOBS_TABLE || 'photobooth-processing-jobs-dev';

export class JobQueueService {
  async createJob(imageUrl: string, themeId: string, variantId?: string): Promise<ProcessingJob> {
    const job: ProcessingJob = {
      jobId: uuidv4(),
      status: 'pending',
      originalImageUrl: imageUrl,
      themeId,
      variantId,
      retryCount: 0,
      outputFormat: 'jpeg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: JOBS_TABLE,
      Item: job
    }));

    return job;
  }

  async updateJobStatus(jobId: string, status: JobStatus, resultUrl?: string, error?: string): Promise<void> {
    let updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
    const expressionAttributeNames = { '#status': 'status' };
    const expressionAttributeValues: any = {
      ':status': status,
      ':updatedAt': new Date().toISOString()
    };

    if (resultUrl) {
      updateExpression += ', resultUrl = :resultUrl';
      expressionAttributeValues[':resultUrl'] = resultUrl;
    }

    if (error) {
      updateExpression += ', errorMessage = :error';
      expressionAttributeValues[':error'] = error;
    }

    await docClient.send(new UpdateCommand({
      TableName: JOBS_TABLE,
      Key: { jobId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
  }

  async getJob(jobId: string): Promise<ProcessingJob | null> {
    const result = await docClient.send(new GetCommand({
      TableName: JOBS_TABLE,
      Key: { jobId }
    }));

    return result.Item as ProcessingJob || null;
  }

  async getPendingJobs(): Promise<ProcessingJob[]> {
    const result = await docClient.send(new ScanCommand({
      TableName: JOBS_TABLE,
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'pending' }
    }));

    return result.Items as ProcessingJob[] || [];
  }
}