import { describe, it, expect } from 'vitest';
import { config } from './index.js';

describe('Config', () => {
  it('should have default values', () => {
    expect(config.port).toBe(3001);
    expect(config.nodeEnv).toBe('test'); // vitest sets NODE_ENV to 'test'
    expect(config.aws.region).toBe('us-east-1');
    expect(config.processing.timeoutMs).toBe(15000);
    expect(config.upload.maxSizeMB).toBe(10);
  });
});