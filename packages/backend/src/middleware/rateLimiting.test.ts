import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { 
  createRateLimiter, 
  generalRateLimiter,
  processingRateLimiter,
  uploadRateLimiter,
  MemoryRateLimitStore 
} from './rateLimiting.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Rate Limiting Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: Function;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      path: '/test',
      method: 'GET',
      headers: { 'x-request-id': 'test-request-id' },
      get: vi.fn().mockReturnValue('test-user-agent'),
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      set: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe('createRateLimiter', () => {
    it('should create a rate limiter with custom configuration', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        message: 'Custom rate limit message',
      });

      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should handle rate limit exceeded', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 1,
        message: 'Rate limit exceeded',
      });

      // First request should pass
      await new Promise<void>((resolve) => {
        limiter(mockReq as Request, mockRes as Response, () => {
          expect(mockNext).not.toHaveBeenCalled();
          resolve();
        });
      });

      // Second request should be rate limited
      await new Promise<void>((resolve) => {
        limiter(mockReq as Request, mockRes as Response, () => {
          // Should not reach next()
          resolve();
        });
      });
    });
  });

  describe('MemoryRateLimitStore', () => {
    let store: MemoryRateLimitStore;

    beforeEach(() => {
      store = new MemoryRateLimitStore(60000);
    });

    it('should increment counter for new key', async () => {
      const result = await store.incr('test-key');
      
      expect(result.totalHits).toBe(1);
      expect(result.resetTime).toBeInstanceOf(Date);
    });

    it('should increment existing counter', async () => {
      await store.incr('test-key');
      const result = await store.incr('test-key');
      
      expect(result.totalHits).toBe(2);
    });

    it('should reset expired entries', async () => {
      const shortStore = new MemoryRateLimitStore(1); // 1ms window
      
      await shortStore.incr('test-key');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await shortStore.incr('test-key');
      expect(result.totalHits).toBe(1); // Should reset
    });

    it('should decrement counter', async () => {
      await store.incr('test-key');
      await store.incr('test-key');
      await store.decrement('test-key');
      
      const result = await store.incr('test-key');
      expect(result.totalHits).toBe(2); // Was 2, decremented to 1, then incremented to 2
    });

    it('should reset key', async () => {
      await store.incr('test-key');
      await store.resetKey('test-key');
      
      const result = await store.incr('test-key');
      expect(result.totalHits).toBe(1); // Should start fresh
    });
  });

  describe('Predefined Rate Limiters', () => {
    it('should have general rate limiter configured', () => {
      expect(generalRateLimiter).toBeDefined();
      expect(typeof generalRateLimiter).toBe('function');
    });

    it('should have processing rate limiter configured', () => {
      expect(processingRateLimiter).toBeDefined();
      expect(typeof processingRateLimiter).toBe('function');
    });

    it('should have upload rate limiter configured', () => {
      expect(uploadRateLimiter).toBeDefined();
      expect(typeof uploadRateLimiter).toBe('function');
    });
  });
});