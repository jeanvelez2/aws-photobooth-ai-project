#!/usr/bin/env node

/**
 * Script to get CloudFront domain from deployed CDK stack
 * Run this after deploying your infrastructure to get the CloudFront domain
 */

const { execSync } = require('child_process');

try {
  console.log('Getting CloudFront domain from deployed stack...\n');
  
  // Get stack outputs
  const result = execSync('npx cdk list --long', { 
    cwd: './packages/infrastructure',
    encoding: 'utf8' 
  });
  
  console.log('Available stacks:');
  console.log(result);
  
  console.log('\nTo get the CloudFront domain, run:');
  console.log('cd packages/infrastructure');
  console.log('npx cdk deploy --outputs-file outputs.json');
  console.log('\nThen check the outputs.json file for "CloudFrontDomainName"');
  
} catch (error) {
  console.error('Error getting stack info:', error.message);
  console.log('\nAlternatively, you can:');
  console.log('1. Go to AWS Console > CloudFormation');
  console.log('2. Find your photobooth stack');
  console.log('3. Go to Outputs tab');
  console.log('4. Look for "CloudFrontDomainName"');
  console.log('5. Copy the value and set it as CLOUDFRONT_DOMAIN in your .env file');
}