import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionPool, BufferPool, ResourceFactory } from './connectionPool.js';

// Mock resource for testing
class MockResource {
  constructor(public id: string, public isHealthy: boolean = true) {}
}

describe('ConnectionPool', () => {
  let pool: ConnectionPool<MockResource>;
  let factory: ResourceFactory<MockResource>;
  let resourceCounter = 0;

  beforeEach(() => {
    resourceCounter = 0;
    factory = {
      create: vi.fn().mockImplementation(async () => {
        return new MockResource(`resource-${++resourceCounter}`);
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
      validate: vi.fn().mockImplementation(async (resource: MockResource) => {
        return resource.isHealthy;
      }),
    };

    pool = new ConnectionPool({
      maxConnections: 5,
      minConnections: 2,
      acquireTimeoutMs: 1000,
      idleTimeoutMs: 5000,
      maxLifetimeMs: 10000,
      healthCheckIntervalMs: 1000,
    }, factory);
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  describe('Resource Acquisition', () => {
    it('should acquire and release resources', async () => {
      const resource = await pool.acquire();
      expect(resource).toBeInstanceOf(MockResource);
      expect(factory.create).toHaveBeenCalled();

      await pool.release(resource);
      expect(true).toBe(true); // No error thrown
    });

    it('should reuse released resources', async () => {
      const resource1 = await pool.acquire();
      await pool.release(resource1);

      const resource2 = await pool.acquire();
      expect(resource2).toBe(resource1); // Same instance reused
    });

    it('should create new resources when pool is empty', async () => {
      const resource1 = await pool.acquire();
      const resource2 = await pool.acquire();

      expect(resource1).not.toBe(resource2);
      expect(factory.create).toHaveBeenCalledTimes(2);

      await pool.release(resource1);
      await pool.release(resource2);
    });

    it('should respect max connections limit', async () => {
      const resources: MockResource[] = [];
      
      // Acquire max connections
      for (let i = 0; i < 5; i++) {
        resources.push(await pool.acquire());
      }

      // Next acquisition should timeout
      const startTime = Date.now();
      try {
        await pool.acquire();
        expect.fail('Should have timed out');
      } catch (error) {
        const duration = Date.now() - startTime;
        expect(duration).toBeGreaterThanOrEqual(1000);
        expect(error).toBeInstanceOf(Error);
      }

      // Release resources
      for (const resource of resources) {
        await pool.release(resource);
      }
    });
  });

  describe('Execute Method', () => {
    it('should execute function with pooled resource', async () => {
      const result = await pool.execute(async (resource) => {
        expect(resource).toBeInstanceOf(MockResource);
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });

    it('should release resource even if function throws', async () => {
      try {
        await pool.execute(async () => {
          throw new Error('Test error');
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Pool should still be functional
      const resource = await pool.acquire();
      expect(resource).toBeInstanceOf(MockResource);
      await pool.release(resource);
    });
  });

  describe('Pool Statistics', () => {
    it('should provide accurate pool statistics', async () => {
      const resource1 = await pool.acquire();
      const resource2 = await pool.acquire();

      const stats = pool.getStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(2);
      expect(stats.activeConnections).toBe(2);
      expect(stats.idleConnections).toBe(stats.totalConnections - 2);
      expect(stats.waitingRequests).toBe(0);

      await pool.release(resource1);
      await pool.release(resource2);
    });
  });

  describe('Health Checks', () => {
    it('should remove unhealthy resources during health check', async () => {
      const resource = await pool.acquire();
      await pool.release(resource);

      // Mark resource as unhealthy
      resource.isHealthy = false;

      // Wait for health check to run
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(factory.validate).toHaveBeenCalled();
      expect(factory.destroy).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const resource = await pool.acquire();
      await pool.release(resource);

      await pool.shutdown();

      expect(factory.destroy).toHaveBeenCalled();

      // Should reject new acquisitions
      try {
        await pool.acquire();
        expect.fail('Should have rejected acquisition after shutdown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});

describe('BufferPool', () => {
  let bufferPool: BufferPool;

  beforeEach(() => {
    bufferPool = new BufferPool();
  });

  afterEach(() => {
    bufferPool.clear();
  });

  describe('Buffer Management', () => {
    it('should provide buffers of requested size', () => {
      const buffer = bufferPool.getBuffer(1024);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(1024);
    });

    it('should reuse returned buffers', () => {
      const buffer1 = bufferPool.getBuffer(4096);
      const originalBuffer = buffer1; // Store reference to original buffer
      bufferPool.returnBuffer(buffer1);

      const buffer2 = bufferPool.getBuffer(4096);
      // Check if the underlying buffer is the same (buffer2 should be a slice of the original)
      expect(buffer2.buffer).toBe(originalBuffer.buffer);
      expect(buffer2.length).toBe(4096);
    });

    it('should handle different buffer sizes', () => {
      const small = bufferPool.getBuffer(1024);
      const medium = bufferPool.getBuffer(16384);
      const large = bufferPool.getBuffer(65536);

      expect(small.length).toBe(1024);
      expect(medium.length).toBe(16384);
      expect(large.length).toBe(65536);
    });

    it('should provide statistics', () => {
      const buffer = bufferPool.getBuffer(4096);
      bufferPool.returnBuffer(buffer);

      const stats = bufferPool.getStats();
      expect(typeof stats).toBe('object');
      expect(stats[4096]).toBeGreaterThan(0);
    });

    it('should clear all pools', () => {
      const buffer = bufferPool.getBuffer(1024);
      bufferPool.returnBuffer(buffer);

      bufferPool.clear();

      const stats = bufferPool.getStats();
      expect(Object.values(stats).every(count => count === 0)).toBe(true);
    });
  });
});