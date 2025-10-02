import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { AwsClientPool } from './connectionPool.js';
import { logger } from '../utils/logger.js';

// AWS Client Pool configurations
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * S3 Client Pool
 */
export const s3ClientPool = new AwsClientPool<S3Client>(
  async () => {
    const client = new S3Client({
      region: AWS_REGION,
      maxAttempts: 3,
      requestHandler: {
        connectionTimeout: 5000,
        requestTimeout: 30000,
      },
    });
    logger.debug('Created new S3 client');
    return client;
  },
  async (client) => {
    try {
      client.destroy();
      logger.debug('Destroyed S3 client');
    } catch (error) {
      logger.error('Error destroying S3 client', { error });
    }
  },
  async (client) => {
    try {
      // Simple health check - list buckets with minimal permissions
      await client.send({ input: {}, name: 'ListBucketsCommand' } as any);
      return true;
    } catch (error) {
      logger.warn('S3 client health check failed', { error });
      return false;
    }
  },
  {
    maxConnections: 15,
    minConnections: 3,
    acquireTimeoutMs: 3000,
    idleTimeoutMs: 300000, // 5 minutes
    maxLifetimeMs: 1800000, // 30 minutes
    healthCheckIntervalMs: 120000, // 2 minutes
  }
);

/**
 * DynamoDB Client Pool
 */
export const dynamoClientPool = new AwsClientPool<DynamoDBClient>(
  async () => {
    const client = new DynamoDBClient({
      region: AWS_REGION,
      maxAttempts: 3,
      requestHandler: {
        connectionTimeout: 3000,
        requestTimeout: 10000,
      },
    });
    logger.debug('Created new DynamoDB client');
    return client;
  },
  async (client) => {
    try {
      client.destroy();
      logger.debug('Destroyed DynamoDB client');
    } catch (error) {
      logger.error('Error destroying DynamoDB client', { error });
    }
  },
  async (client) => {
    try {
      // Simple health check - list tables
      await client.send({ input: { Limit: 1 }, name: 'ListTablesCommand' } as any);
      return true;
    } catch (error) {
      logger.warn('DynamoDB client health check failed', { error });
      return false;
    }
  },
  {
    maxConnections: 10,
    minConnections: 2,
    acquireTimeoutMs: 2000,
    idleTimeoutMs: 600000, // 10 minutes
    maxLifetimeMs: 3600000, // 1 hour
    healthCheckIntervalMs: 180000, // 3 minutes
  }
);

/**
 * Rekognition Client Pool
 */
export const rekognitionClientPool = new AwsClientPool<RekognitionClient>(
  async () => {
    const client = new RekognitionClient({
      region: AWS_REGION,
      maxAttempts: 3,
      requestHandler: {
        connectionTimeout: 5000,
        requestTimeout: 30000,
      },
    });
    logger.debug('Created new Rekognition client');
    return client;
  },
  async (client) => {
    try {
      client.destroy();
      logger.debug('Destroyed Rekognition client');
    } catch (error) {
      logger.error('Error destroying Rekognition client', { error });
    }
  },
  async (client) => {
    try {
      // Health check by describing collections (minimal operation)
      await client.send({ input: { MaxResults: 1 }, name: 'ListCollectionsCommand' } as any);
      return true;
    } catch (error) {
      logger.warn('Rekognition client health check failed', { error });
      return false;
    }
  },
  {
    maxConnections: 8,
    minConnections: 2,
    acquireTimeoutMs: 5000,
    idleTimeoutMs: 300000, // 5 minutes
    maxLifetimeMs: 1800000, // 30 minutes
    healthCheckIntervalMs: 240000, // 4 minutes
  }
);

/**
 * CloudWatch Client Pool
 */
export const cloudWatchClientPool = new AwsClientPool<CloudWatchClient>(
  async () => {
    const client = new CloudWatchClient({
      region: AWS_REGION,
      maxAttempts: 3,
      requestHandler: {
        connectionTimeout: 3000,
        requestTimeout: 15000,
      },
    });
    logger.debug('Created new CloudWatch client');
    return client;
  },
  async (client) => {
    try {
      client.destroy();
      logger.debug('Destroyed CloudWatch client');
    } catch (error) {
      logger.error('Error destroying CloudWatch client', { error });
    }
  },
  async (client) => {
    try {
      // Health check by listing metrics (minimal operation)
      await client.send({ input: { MaxRecords: 1 }, name: 'ListMetricsCommand' } as any);
      return true;
    } catch (error) {
      logger.warn('CloudWatch client health check failed', { error });
      return false;
    }
  },
  {
    maxConnections: 5,
    minConnections: 1,
    acquireTimeoutMs: 2000,
    idleTimeoutMs: 900000, // 15 minutes
    maxLifetimeMs: 3600000, // 1 hour
    healthCheckIntervalMs: 300000, // 5 minutes
  }
);

/**
 * Get pool statistics for all AWS client pools
 */
export function getAwsClientPoolStats() {
  return {
    s3: s3ClientPool.getStats(),
    dynamodb: dynamoClientPool.getStats(),
    rekognition: rekognitionClientPool.getStats(),
    cloudwatch: cloudWatchClientPool.getStats(),
  };
}

/**
 * Shutdown all AWS client pools
 */
export async function shutdownAwsClientPools(): Promise<void> {
  logger.info('Shutting down AWS client pools');
  
  await Promise.all([
    s3ClientPool.shutdown(),
    dynamoClientPool.shutdown(),
    rekognitionClientPool.shutdown(),
    cloudWatchClientPool.shutdown(),
  ]);
  
  logger.info('All AWS client pools shut down');
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down AWS client pools');
  await shutdownAwsClientPools();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down AWS client pools');
  await shutdownAwsClientPools();
});