import { cloudWatchClientPool } from './awsClientPool.js';
import { PutMetricDataCommand, MetricDatum } from '@aws-sdk/client-cloudwatch';
import { logger } from '../utils/logger.js';
import { getAwsClientPoolStats } from './awsClientPool.js';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export interface ProcessingMetrics {
  processingTime: number;
  queueDepth: number;
  successRate: number;
  errorRate: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * Performance monitoring service for tracking application metrics
 */
export class PerformanceMonitoringService {
  private readonly namespace = 'AI-Photobooth';
  private readonly environment = process.env.NODE_ENV || 'development';
  private readonly metricsBuffer: MetricDatum[] = [];
  private readonly bufferFlushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;
  
  // Performance tracking
  private readonly activeRequests = new Map<string, { startTime: number; operation: string }>();
  private readonly recentMetrics: ProcessingMetrics[] = [];
  private readonly maxRecentMetrics = 100;

  constructor() {
    this.startMetricsFlush();
    this.startSystemMetricsCollection();
  }

  /**
   * Track the start of an operation
   */
  startOperation(operationId: string, operationType: string): void {
    this.activeRequests.set(operationId, {
      startTime: Date.now(),
      operation: operationType,
    });
  }

  /**
   * Track the completion of an operation
   */
  endOperation(operationId: string, success: boolean = true): number {
    const operation = this.activeRequests.get(operationId);
    if (!operation) {
      logger.warn('Attempted to end unknown operation', { operationId });
      return 0;
    }

    const duration = Date.now() - operation.startTime;
    this.activeRequests.delete(operationId);

    // Record metrics
    this.recordMetric({
      name: 'ProcessingTime',
      value: duration,
      unit: 'Milliseconds',
      dimensions: {
        Environment: this.environment,
        Operation: operation.operation,
        Status: success ? 'Success' : 'Failure',
      },
    });

    this.recordMetric({
      name: success ? 'SuccessCount' : 'ErrorCount',
      value: 1,
      unit: 'Count',
      dimensions: {
        Environment: this.environment,
        Operation: operation.operation,
      },
    });

    return duration;
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric): void {
    const metricDatum: MetricDatum = {
      MetricName: metric.name,
      Value: metric.value,
      Unit: metric.unit as any,
      Timestamp: metric.timestamp || new Date(),
      Dimensions: metric.dimensions ? Object.entries(metric.dimensions).map(([Name, Value]) => ({
        Name,
        Value,
      })) : undefined,
    };

    this.metricsBuffer.push(metricDatum);

    // Flush immediately if buffer is getting full
    if (this.metricsBuffer.length >= 20) {
      this.flushMetrics();
    }
  }

  /**
   * Record processing queue depth
   */
  recordQueueDepth(depth: number): void {
    this.recordMetric({
      name: 'ProcessingQueueDepth',
      value: depth,
      unit: 'Count',
      dimensions: {
        Environment: this.environment,
      },
    });
  }

  /**
   * Record memory usage metrics
   */
  recordMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    
    this.recordMetric({
      name: 'MemoryUsage',
      value: memUsage.heapUsed / 1024 / 1024, // Convert to MB
      unit: 'Megabytes',
      dimensions: {
        Environment: this.environment,
        Type: 'HeapUsed',
      },
    });

    this.recordMetric({
      name: 'MemoryUsage',
      value: memUsage.heapTotal / 1024 / 1024,
      unit: 'Megabytes',
      dimensions: {
        Environment: this.environment,
        Type: 'HeapTotal',
      },
    });

    this.recordMetric({
      name: 'MemoryUsage',
      value: memUsage.rss / 1024 / 1024,
      unit: 'Megabytes',
      dimensions: {
        Environment: this.environment,
        Type: 'RSS',
      },
    });
  }

  /**
   * Record CPU usage metrics
   */
  recordCpuUsage(): void {
    const cpuUsage = process.cpuUsage();
    const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    this.recordMetric({
      name: 'CpuUsage',
      value: totalUsage,
      unit: 'Seconds',
      dimensions: {
        Environment: this.environment,
      },
    });
  }

  /**
   * Record connection pool metrics
   */
  recordConnectionPoolMetrics(): void {
    const poolStats = getAwsClientPoolStats();

    for (const [poolName, stats] of Object.entries(poolStats)) {
      this.recordMetric({
        name: 'ConnectionPoolSize',
        value: stats.totalConnections,
        unit: 'Count',
        dimensions: {
          Environment: this.environment,
          Pool: poolName,
          Type: 'Total',
        },
      });

      this.recordMetric({
        name: 'ConnectionPoolSize',
        value: stats.activeConnections,
        unit: 'Count',
        dimensions: {
          Environment: this.environment,
          Pool: poolName,
          Type: 'Active',
        },
      });

      this.recordMetric({
        name: 'ConnectionPoolSize',
        value: stats.waitingRequests,
        unit: 'Count',
        dimensions: {
          Environment: this.environment,
          Pool: poolName,
          Type: 'Waiting',
        },
      });
    }
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats(): {
    activeOperations: number;
    averageProcessingTime: number;
    recentSuccessRate: number;
    memoryUsage: NodeJS.MemoryUsage;
    connectionPools: ReturnType<typeof getAwsClientPoolStats>;
  } {
    const memUsage = process.memoryUsage();
    const poolStats = getAwsClientPoolStats();

    // Calculate recent success rate
    const recentSuccesses = this.recentMetrics.filter(m => m.successRate > 0).length;
    const recentSuccessRate = this.recentMetrics.length > 0 
      ? recentSuccesses / this.recentMetrics.length 
      : 1;

    // Calculate average processing time
    const avgProcessingTime = this.recentMetrics.length > 0
      ? this.recentMetrics.reduce((sum, m) => sum + m.processingTime, 0) / this.recentMetrics.length
      : 0;

    return {
      activeOperations: this.activeRequests.size,
      averageProcessingTime: avgProcessingTime,
      recentSuccessRate,
      memoryUsage: memUsage,
      connectionPools: poolStats,
    };
  }

  /**
   * Check if system is under high load
   */
  isSystemUnderHighLoad(): boolean {
    const stats = this.getPerformanceStats();
    const memUsage = stats.memoryUsage;
    
    // Check memory usage (consider high if heap used > 80% of heap total)
    const memoryPressure = (memUsage.heapUsed / memUsage.heapTotal) > 0.8;
    
    // Check active operations (consider high if > 50 concurrent operations)
    const highConcurrency = stats.activeOperations > 50;
    
    // Check connection pool pressure
    const poolPressure = Object.values(stats.connectionPools).some(pool => 
      pool.waitingRequests > 5 || (pool.activeConnections / pool.totalConnections) > 0.9
    );

    return memoryPressure || highConcurrency || poolPressure;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getPerformanceStats();
    
    // Memory recommendations
    const memUsage = stats.memoryUsage;
    const heapUtilization = memUsage.heapUsed / memUsage.heapTotal;
    
    if (heapUtilization > 0.8) {
      recommendations.push('High memory usage detected. Consider increasing heap size or optimizing memory usage.');
    }
    
    if (memUsage.rss > 1024 * 1024 * 1024) { // 1GB
      recommendations.push('High RSS memory usage. Check for memory leaks.');
    }

    // Concurrency recommendations
    if (stats.activeOperations > 30) {
      recommendations.push('High number of concurrent operations. Consider implementing request queuing.');
    }

    // Connection pool recommendations
    for (const [poolName, poolStats] of Object.entries(stats.connectionPools)) {
      if (poolStats.waitingRequests > 3) {
        recommendations.push(`${poolName} connection pool has waiting requests. Consider increasing pool size.`);
      }
      
      if (poolStats.totalConnections === 0) {
        recommendations.push(`${poolName} connection pool is empty. Check pool configuration.`);
      }
    }

    // Processing time recommendations
    if (stats.averageProcessingTime > 10000) { // 10 seconds
      recommendations.push('High average processing time. Consider optimizing image processing algorithms.');
    }

    return recommendations;
  }

  /**
   * Flush metrics to CloudWatch
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToFlush = this.metricsBuffer.splice(0, 20); // CloudWatch limit is 20 metrics per request

    try {
      await cloudWatchClientPool.execute(async (client) => {
        const command = new PutMetricDataCommand({
          Namespace: this.namespace,
          MetricData: metricsToFlush,
        });
        
        return await client.send(command);
      });

      logger.debug('Metrics flushed to CloudWatch', { count: metricsToFlush.length });
    } catch (error) {
      logger.error('Failed to flush metrics to CloudWatch', { 
        error: error instanceof Error ? error.message : error,
        metricsCount: metricsToFlush.length,
      });
      
      // Put metrics back in buffer for retry (at the beginning)
      this.metricsBuffer.unshift(...metricsToFlush);
    }
  }

  /**
   * Start periodic metrics flushing
   */
  private startMetricsFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.bufferFlushInterval);
  }

  /**
   * Start system metrics collection
   */
  private startSystemMetricsCollection(): void {
    // Collect system metrics every minute
    setInterval(() => {
      this.recordMemoryUsage();
      this.recordCpuUsage();
      this.recordConnectionPoolMetrics();
    }, 60000);
  }

  /**
   * Shutdown the monitoring service
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Flush any remaining metrics
    await this.flushMetrics();
    
    logger.info('Performance monitoring service shut down');
  }
}

// Export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await performanceMonitoringService.shutdown();
});

process.on('SIGINT', async () => {
  await performanceMonitoringService.shutdown();
});