#!/usr/bin/env node

import { processingJobService } from '../services/processingJob.js';
import { ProcessingRequest } from 'shared';

console.log('🧪 Creating Test Job for Worker');
console.log('===============================');

async function createTestJob() {
  const testRequest: ProcessingRequest = {
    photoId: 'test-photo-123',
    userId: 'test-user',
    originalImageUrl: 'uploads/test-image.jpg', // This would need to be a real image in S3
    themeId: 'barbarian', // Using barbarian theme
    variantId: 'barbarian-warrior',
    outputFormat: 'jpeg'
  };

  try {
    console.log('📝 Creating test job with request:', testRequest);
    const job = await processingJobService.createJob(testRequest);
    console.log('✅ Test job created successfully!');
    console.log(`   Job ID: ${job.jobId}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Theme: ${job.themeId}`);
    console.log(`   Variant: ${job.variantId}`);
    console.log(`   Created: ${job.createdAt}`);
    
    console.log('\n🔍 The worker should pick up this job within 5 seconds...');
    console.log('💡 Check the worker logs to see if it processes this job.');
    
    return job.jobId;
  } catch (error) {
    console.error('❌ Failed to create test job:', error);
    process.exit(1);
  }
}

// Run test job creation
createTestJob().catch(error => {
  console.error('❌ Test job creation failed:', error);
  process.exit(1);
});