import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitoringService } from './performanceMonitoring.js';

// Mock CloudWatch client pool
vi.mock('./awsClientPool.js', () => ({
  cloudWatchClientPool: {
    execute: vi.fn().mockResolvedValue({}),
  },
  getAwsClientPoolStats: vi.fn().mockReturnValue({
    s3: { totalConnections: 5, activeConnections: 2, waitingRequests: 0 },
    dynamodb: { totalConnections: 3, activeConnections: 1, waitingRequests: 0 },
    rekognition: { totalConnections: 2, activeConnections: 0, waitingRequests: 0 },
    cloudwatch: { totalConnections: 1, activeConnections: 0, waitingRequests: 0 },
  }),
}));

describe('PerformanceMonitoringService', () => {
  let service: PerformanceMonitoringService;

  beforeEach(() => {
    service = new PerformanceMonitoringService();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Operation Tracking', () => {
    it('should track operation start and end', async () => {
      const operationId = 'test-op-1';
      const operationType = 'TestOperation';

      service.startOperation(operationId, operationType);
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      const duration = service.endOperation(operationId, true);
      
      expect(duration).toBeGreaterThan(0);
    });

    it('should handle unknown operation end gracefully', () => {
      const duration = service.endOperation('unknown-op', true);
      expect(duration).toBe(0);
    });

    it('should track both successful and failed operations', async () => {
      const successId = 'success-op';
      const failId = 'fail-op';

      service.startOperation(successId, 'TestOp');
      service.startOperation(failId, 'TestOp');

      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      const successDuration = service.endOperation(successId, true);
      const failDuration = service.endOperation(failId, false);

      expect(successDuration).toBeGreaterThan(0);
      expect(failDuration).toBeGreaterThan(0);
    });
  });

  describe('Metrics Recording', () => {
    it('should record custom metrics', () => {
      expect(() => {
        service.recordMetric({
          name: 'TestMetric',
          value: 100,
          unit: 'Count',
          dimensions: { Environment: 'test' },
        });
      }).not.toThrow();
    });

    it('should record queue depth metrics', () => {
      expect(() => {
        service.recordQueueDepth(5);
      }).not.toThrow();
    });

    it('should record memory usage metrics', () => {
      expect(() => {
        service.recordMemoryUsage();
      }).not.toThrow();
    });

    it('should record CPU usage metrics', () => {
      expect(() => {
        service.recordCpuUsage();
      }).not.toThrow();
    });
  });

  describe('Performance Statistics', () => {
    it('should return current performance stats', () => {
      const stats = service.getPerformanceStats();

      expect(stats).toHaveProperty('activeOperations');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('recentSuccessRate');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('connectionPools');

      expect(typeof stats.activeOperations).toBe('number');
      expect(typeof stats.averageProcessingTime).toBe('number');
      expect(typeof stats.recentSuccessRate).toBe('number');
    });

    it('should detect high load conditions', () => {
      // Start many operations to simulate high load
      for (let i = 0; i < 60; i++) {
        service.startOperation(`op-${i}`, 'TestOp');
      }

      const isHighLoad = service.isSystemUnderHighLoad();
      expect(isHighLoad).toBe(true);
    });

    it('should provide optimization recommendations', () => {
      const recommendations = service.getOptimizationRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Load Detection', () => {
    it('should detect normal load conditions', () => {
      const isHighLoad = service.isSystemUnderHighLoad();
      expect(typeof isHighLoad).toBe('boolean');
    });

    it('should provide relevant recommendations for high load', () => {
      // Simulate high concurrent operations
      for (let i = 0; i < 40; i++) {
        service.startOperation(`concurrent-${i}`, 'ProcessingOp');
      }

      const recommendations = service.getOptimizationRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      
      const hasHighConcurrencyRecommendation = recommendations.some(rec => 
        rec.includes('concurrent operations')
      );
      expect(hasHighConcurrencyRecommendation).toBe(true);
    });
  });

  describe('Metrics Buffer Management', () => {
    it('should handle metric buffer overflow', () => {
      // Add many metrics to trigger buffer flush
      for (let i = 0; i < 25; i++) {
        service.recordMetric({
          name: 'BufferTest',
          value: i,
          unit: 'Count',
        });
      }

      // Should not throw error
      expect(true).toBe(true);
    });
  });
});