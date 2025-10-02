import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Initialize AWS clients
const s3Client = new S3Client({
  region: config.aws.region,
});

const dynamoDBClient = new DynamoDBClient({
  region: config.aws.region,
});

const dynamoDBDocClient = DynamoDBDocumentClient.from(dynamoDBClient);

const rekognitionClient = new RekognitionClient({
  region: config.aws.region,
});

logger.info('AWS services initialized', {
  region: config.aws.region,
  s3Bucket: config.aws.s3.bucket,
  processingJobsTable: config.aws.dynamodb.processingJobsTable,
  themesTable: config.aws.dynamodb.themesTable,
});

export { s3Client, dynamoDBDocClient, rekognitionClient };