/**
 * Simple compilation test to verify CDK infrastructure compiles correctly
 */

import * as assert from 'assert';
import { PhotoboothStack } from '../src/stacks/photobooth-stack';
import { CicdStack } from '../src/stacks/cicd-stack';
import { environments } from '../src/config/environments';

// Simple test function
function runTests() {
  console.log('Running infrastructure compilation tests...');

  // Test 1: Verify stacks are defined
  assert(PhotoboothStack !== undefined, 'PhotoboothStack should be defined');
  assert(CicdStack !== undefined, 'CicdStack should be defined');
  console.log('✅ CDK stacks compile without errors');

  // Test 2: Verify environments are defined
  assert(environments.dev !== undefined, 'dev environment should be defined');
  assert(environments.staging !== undefined, 'staging environment should be defined');
  assert(environments.prod !== undefined, 'prod environment should be defined');
  console.log('✅ Environment configurations are defined');

  // Test 3: Verify environment configurations are valid
  assert(environments.dev.environment === 'dev', 'dev environment name should be correct');
  assert(environments.dev.region === 'us-east-1', 'dev region should be us-east-1');
  assert(environments.dev.autoScaling.minCapacity > 0, 'dev min capacity should be greater than 0');
  assert(environments.dev.autoScaling.maxCapacity > environments.dev.autoScaling.minCapacity, 'dev max capacity should be greater than min capacity');

  assert(environments.staging.environment === 'staging', 'staging environment name should be correct');
  assert(environments.staging.enableXRay === true, 'staging should have X-Ray enabled');
  assert(environments.staging.enableWaf === true, 'staging should have WAF enabled');

  assert(environments.prod.environment === 'prod', 'prod environment name should be correct');
  assert(environments.prod.monitoring.enableDetailedMonitoring === true, 'prod should have detailed monitoring enabled');
  assert(environments.prod.monitoring.alarmEmail !== undefined, 'prod should have alarm email defined');
  console.log('✅ Environment configurations are valid');

  console.log('🎉 All infrastructure compilation tests passed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  try {
    runTests();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { runTests };