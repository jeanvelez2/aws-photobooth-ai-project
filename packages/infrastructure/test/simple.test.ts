/**
 * Simple test to verify CDK infrastructure compiles correctly
 */

import { PhotoboothStack } from '../src/stacks/photobooth-stack';
import { CicdStack } from '../src/stacks/cicd-stack';
import { environments } from '../src/config/environments';

describe('Infrastructure Compilation', () => {
  test('CDK stacks compile without errors', () => {
    // Import the stacks to verify they compile
    expect(PhotoboothStack).toBeDefined();
    expect(CicdStack).toBeDefined();
    expect(environments.dev).toBeDefined();
    expect(environments.staging).toBeDefined();
    expect(environments.prod).toBeDefined();
  });

  test('Environment configurations are valid', () => {
    // Test dev environment
    expect(environments.dev.environment).toBe('dev');
    expect(environments.dev.region).toBe('us-east-1');
    expect(environments.dev.autoScaling.minCapacity).toBeGreaterThan(0);
    expect(environments.dev.autoScaling.maxCapacity).toBeGreaterThan(environments.dev.autoScaling.minCapacity);

    // Test staging environment
    expect(environments.staging.environment).toBe('staging');
    expect(environments.staging.enableXRay).toBe(true);
    expect(environments.staging.enableWaf).toBe(true);

    // Test prod environment
    expect(environments.prod.environment).toBe('prod');
    expect(environments.prod.monitoring.enableDetailedMonitoring).toBe(true);
    expect(environments.prod.monitoring.alarmEmail).toBeDefined();
  });
});