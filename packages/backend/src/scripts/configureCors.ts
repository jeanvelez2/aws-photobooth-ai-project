#!/usr/bin/env node

import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'ai-photobooth-dev';

async function configureCors() {
  console.log('🔧 Configuring S3 CORS...');

  const corsConfiguration = {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedOrigins: [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://*.cloudfront.net'
        ],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3000
      }
    ]
  };

  try {
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: corsConfiguration
    }));

    console.log('✅ S3 CORS configured successfully!');
  } catch (error) {
    console.error('❌ Error configuring CORS:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  configureCors();
}

export { configureCors };