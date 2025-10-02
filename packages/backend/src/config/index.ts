import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    s3: {
      bucketName: process.env.S3_BUCKET_NAME || 'ai-photobooth-dev',
      bucket: process.env.S3_BUCKET_NAME || 'ai-photobooth-dev', // Keep for backward compatibility
    },
    dynamodb: {
      processingJobsTable:
        process.env.DYNAMODB_PROCESSING_JOBS_TABLE || 'processing-jobs-dev',
      themesTable: process.env.DYNAMODB_THEMES_TABLE || 'themes-dev',
      useLocal: process.env.USE_LOCAL_DYNAMODB === 'true',
    },
  },
  processing: {
    timeoutMs: parseInt(process.env.PROCESSING_TIMEOUT_MS || '15000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  },
  upload: {
    maxSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10),
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    presignedUrlExpiryMinutes: parseInt(
      process.env.PRESIGNED_URL_EXPIRY_MINUTES || '15',
      10
    ),
  },
};
