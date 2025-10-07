import { describe, it, expect } from 'vitest';
import { config, getPublicImageUrl } from './index.js';

describe('Config', () => {
  it('should have default values', () => {
    expect(config.port).toBe(3001);
    expect(config.nodeEnv).toBe('test'); // vitest sets NODE_ENV to 'test'
    expect(config.aws.region).toBe('us-east-1');
    expect(config.processing.timeoutMs).toBe(15000);
    expect(config.upload.maxSizeMB).toBe(10);
    expect(config.aws.cloudfront.distributionDomain).toBeNull();
  });

  it('should generate S3 URLs when CloudFront is not configured', () => {
    const imageKey = 'processed/test-image.jpg';
    const url = getPublicImageUrl(imageKey);
    expect(url).toMatch(/^https:\/\/.*\.s3\.amazonaws\.com\/processed\/test-image\.jpg$/);
  });

  it('should generate CloudFront URLs when configured', () => {
    const originalDomain = config.aws.cloudfront.distributionDomain;
    // Mock CloudFront domain
    (config.aws.cloudfront as any).distributionDomain = 'd123456789.cloudfront.net';
    
    const imageKey = 'processed/test-image.jpg';
    const url = getPublicImageUrl(imageKey);
    expect(url).toBe('https://d123456789.cloudfront.net/processed/test-image.jpg');
    
    // Restore original value
    (config.aws.cloudfront as any).distributionDomain = originalDomain;
  });
});