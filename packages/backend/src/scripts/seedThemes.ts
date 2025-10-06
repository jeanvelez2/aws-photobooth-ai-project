#!/usr/bin/env node

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockThemes } from '../data/mockThemes.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const THEMES_TABLE = process.env.THEMES_TABLE || 'photobooth-themes-dev';
// Get S3_BUCKET_URL from environment or parameter
function getS3BucketUrl(bucketUrlParam?: string): string {
  if (bucketUrlParam) return bucketUrlParam;
  if (process.env.S3_BUCKET_URL) return process.env.S3_BUCKET_URL;
  if (process.env.S3_BUCKET_NAME) {
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${process.env.S3_BUCKET_NAME}.s3.${region}.amazonaws.com`;
  }
  return 'https://example.com';
}

// Function to convert relative URLs to absolute S3 URLs
function makeAbsoluteUrl(relativeUrl: string, bucketUrl: string): string {
  if (relativeUrl.startsWith('http')) return relativeUrl;
  return `${bucketUrl}${relativeUrl}`;
}

async function seedThemes(bucketUrlParam?: string) {
  const S3_BUCKET_URL = getS3BucketUrl(bucketUrlParam);
  console.log('🌱 Seeding themes to DynamoDB...');
  console.log(`📦 Using S3 bucket URL: ${S3_BUCKET_URL}`);
  
  try {
    for (const theme of mockThemes) {
      // Convert relative URLs to absolute S3 URLs
      const processedTheme = {
        ...theme,
        thumbnailUrl: makeAbsoluteUrl(theme.thumbnailUrl, S3_BUCKET_URL),
        templateUrl: makeAbsoluteUrl(theme.templateUrl, S3_BUCKET_URL),
        variants: theme.variants.map(variant => ({
          ...variant,
          thumbnailUrl: makeAbsoluteUrl(variant.thumbnailUrl, S3_BUCKET_URL),
          templateUrl: makeAbsoluteUrl(variant.templateUrl, S3_BUCKET_URL),
          blendingMask: makeAbsoluteUrl(variant.blendingMask, S3_BUCKET_URL)
        }))
      };
      const command = new PutCommand({
        TableName: THEMES_TABLE,
        Item: {
          id: processedTheme.id,
          name: processedTheme.name,
          description: processedTheme.description,
          category: processedTheme.category,
          thumbnailUrl: processedTheme.thumbnailUrl,
          templateUrl: processedTheme.templateUrl,
          variants: processedTheme.variants,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });

      await docClient.send(command);
      console.log(`✅ Seeded theme: ${theme.name}`);
    }

    console.log(`🎉 Successfully seeded ${mockThemes.length} themes!`);
  } catch (error) {
    console.error('❌ Error seeding themes:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedThemes();
}

export { seedThemes };