#!/usr/bin/env node

import { config } from '../config/index.js';
import { processingJobService } from '../services/processingJob.js';
import { ThemeService } from '../services/themeService.js';
import { FaceDetectionService } from '../services/faceDetectionService.js';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

console.log('🔍 AI Photobooth Worker Diagnostics');
console.log('=====================================');

async function diagnoseWorker() {
  console.log('\n📋 Configuration:');
  console.log(`  AWS Region: ${config.aws.region}`);
  console.log(`  S3 Bucket: ${config.aws.s3.bucketName}`);
  console.log(`  Processing Jobs Table: ${config.aws.dynamodb.processingJobsTable}`);
  console.log(`  Themes Table: ${config.aws.dynamodb.themesTable}`);
  console.log(`  Node Environment: ${config.nodeEnv}`);

  // Test 1: DynamoDB Tables
  console.log('\n🗄️  Testing DynamoDB Tables...');
  try {
    const dynamoClient = new DynamoDBClient({ region: config.aws.region });
    const tablesResult = await dynamoClient.send(new ListTablesCommand({}));
    console.log(`  ✅ DynamoDB connection successful`);
    console.log(`  📊 Available tables: ${tablesResult.TableNames?.length || 0}`);
    
    const processingTableExists = tablesResult.TableNames?.includes(config.aws.dynamodb.processingJobsTable);
    const themesTableExists = tablesResult.TableNames?.includes(config.aws.dynamodb.themesTable);
    
    console.log(`  ${processingTableExists ? '✅' : '❌'} Processing jobs table: ${config.aws.dynamodb.processingJobsTable}`);
    console.log(`  ${themesTableExists ? '✅' : '❌'} Themes table: ${config.aws.dynamodb.themesTable}`);
    
    if (!processingTableExists || !themesTableExists) {
      console.log('  ⚠️  Missing tables detected!');
    }
  } catch (error) {
    console.log(`  ❌ DynamoDB connection failed: ${error}`);
  }

  // Test 2: S3 Bucket
  console.log('\n🪣 Testing S3 Bucket...');
  try {
    const s3Client = new S3Client({ region: config.aws.region });
    const s3Result = await s3Client.send(new ListObjectsV2Command({
      Bucket: config.aws.s3.bucketName,
      MaxKeys: 5
    }));
    console.log(`  ✅ S3 bucket access successful`);
    console.log(`  📁 Objects in bucket: ${s3Result.KeyCount || 0}`);
    
    if (s3Result.Contents && s3Result.Contents.length > 0) {
      console.log(`  📄 Sample objects:`);
      s3Result.Contents.slice(0, 3).forEach(obj => {
        console.log(`    - ${obj.Key}`);
      });
    }
  } catch (error) {
    console.log(`  ❌ S3 bucket access failed: ${error}`);
  }

  // Test 3: Processing Jobs
  console.log('\n⚙️  Testing Processing Jobs Service...');
  try {
    const queuedJobs = await processingJobService.getJobsByStatus('queued', 5);
    console.log(`  ✅ Processing jobs service working`);
    console.log(`  📋 Queued jobs: ${queuedJobs.length}`);
    
    if (queuedJobs.length > 0) {
      console.log(`  🔍 Sample queued jobs:`);
      queuedJobs.slice(0, 2).forEach(job => {
        console.log(`    - Job ${job.jobId}: ${job.themeId} (created: ${job.createdAt})`);
      });
    }
  } catch (error) {
    console.log(`  ❌ Processing jobs service failed: ${error}`);
  }

  // Test 4: Themes
  console.log('\n🎨 Testing Themes Service...');
  try {
    const themeService = new ThemeService();
    const themes = await themeService.getAllThemes();
    console.log(`  ✅ Themes service working`);
    console.log(`  🎭 Available themes: ${themes.length}`);
    
    if (themes.length > 0) {
      console.log(`  🎪 Theme list:`);
      themes.forEach(theme => {
        console.log(`    - ${theme.id}: ${theme.name} (${theme.variants?.length || 0} variants)`);
      });
    } else {
      console.log(`  ⚠️  No themes found! Run 'npm run seed:themes' to add themes.`);
    }
  } catch (error) {
    console.log(`  ❌ Themes service failed: ${error}`);
  }

  // Test 5: Face Detection (if we have a test image)
  console.log('\n👤 Testing Face Detection Service...');
  try {
    const faceDetectionService = new FaceDetectionService();
    console.log(`  ✅ Face detection service initialized`);
    console.log(`  ⚠️  Skipping face detection test (requires test image in S3)`);
  } catch (error) {
    console.log(`  ❌ Face detection service failed: ${error}`);
  }

  // Test 6: Environment Variables
  console.log('\n🌍 Environment Variables Check:');
  const envVars = [
    'AWS_REGION',
    'S3_BUCKET_NAME', 
    'PROCESSING_JOBS_TABLE',
    'THEMES_TABLE',
    'NODE_ENV'
  ];
  
  envVars.forEach(varName => {
    const value = process.env[varName];
    console.log(`  ${value ? '✅' : '❌'} ${varName}: ${value || 'NOT SET'}`);
  });

  console.log('\n🏁 Diagnosis Complete!');
  console.log('\n💡 Next Steps:');
  console.log('  1. If themes are missing: npm run seed:themes');
  console.log('  2. If tables are missing: Check CDK deployment');
  console.log('  3. If S3 access fails: Check IAM permissions');
  console.log('  4. If environment variables are missing: Check ECS task definition');
}

// Run diagnostics
diagnoseWorker().catch(error => {
  console.error('❌ Diagnostics failed:', error);
  process.exit(1);
});