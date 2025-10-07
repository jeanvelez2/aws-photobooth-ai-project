#!/usr/bin/env node

import { config } from '../config/index.js';
import { seedThemes } from './seedThemes.js';
import { ThemeService } from '../services/themeService.js';
import { processingJobService } from '../services/processingJob.js';

console.log('🔧 AI Photobooth Worker Issue Fixer');
console.log('====================================');

async function fixWorkerIssues() {
  console.log('\n🔍 Checking for common issues...');

  // Issue 1: Missing themes
  console.log('\n🎨 Checking themes...');
  try {
    const themeService = new ThemeService();
    const themes = await themeService.getAllThemes();
    
    if (themes.length === 0) {
      console.log('  ❌ No themes found in database');
      console.log('  🔧 Attempting to seed themes...');
      
      try {
        await seedThemes('https://example.cloudfront.net'); // Use placeholder URL
        console.log('  ✅ Themes seeded successfully');
      } catch (error) {
        console.log(`  ❌ Failed to seed themes: ${error}`);
      }
    } else {
      console.log(`  ✅ Found ${themes.length} themes in database`);
      themes.forEach(theme => {
        console.log(`    - ${theme.id}: ${theme.name} (${theme.variants?.length || 0} variants)`);
      });
    }
  } catch (error) {
    console.log(`  ❌ Failed to check themes: ${error}`);
  }

  // Issue 2: Stuck jobs
  console.log('\n⚙️  Checking for stuck jobs...');
  try {
    const processingJobs = await processingJobService.getJobsByStatus('processing', 10);
    const queuedJobs = await processingJobService.getJobsByStatus('queued', 10);
    
    console.log(`  📊 Processing jobs: ${processingJobs.length}`);
    console.log(`  📊 Queued jobs: ${queuedJobs.length}`);
    
    // Reset stuck processing jobs to queued
    if (processingJobs.length > 0) {
      console.log('  🔧 Resetting stuck processing jobs to queued...');
      for (const job of processingJobs) {
        try {
          await processingJobService.updateJobStatus(job.jobId, 'queued');
          console.log(`    ✅ Reset job ${job.jobId} to queued`);
        } catch (error) {
          console.log(`    ❌ Failed to reset job ${job.jobId}: ${error}`);
        }
      }
    }
  } catch (error) {
    console.log(`  ❌ Failed to check jobs: ${error}`);
  }

  // Issue 3: Configuration check
  console.log('\n⚙️  Configuration summary:');
  console.log(`  AWS Region: ${config.aws.region}`);
  console.log(`  S3 Bucket: ${config.aws.s3.bucketName}`);
  console.log(`  Processing Jobs Table: ${config.aws.dynamodb.processingJobsTable}`);
  console.log(`  Themes Table: ${config.aws.dynamodb.themesTable}`);

  console.log('\n✅ Fix attempt completed!');
  console.log('\n💡 If issues persist:');
  console.log('  1. Check AWS credentials and permissions');
  console.log('  2. Verify ECS task definition environment variables');
  console.log('  3. Check CloudWatch logs for detailed error messages');
  console.log('  4. Run: npm run diagnose');
}

// Run fixes
fixWorkerIssues().catch(error => {
  console.error('❌ Fix script failed:', error);
  process.exit(1);
});