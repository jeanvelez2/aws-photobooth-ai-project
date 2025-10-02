import { CloudWatchClient, PutMetricDataCommand, MetricDatum } from '@aws-sdk/client-cloudwatch';
import { logger } from '../utils/logger.js';

export interface MetricData {
  metricName: string;
  value: number;
  unit: 'Count' | 'Seconds' | 'Milliseconds' | 'Percent' | 'Bytes';
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export interface ProcessingMetrics {
  processingTimeMs: number;
  success: boolean;
  errorType?: string;
  themeId?: string;
  imageSize?: number;
}

class MonitoringService {
  private cloudWatchClient: CloudWatchClient;
  private namespace: string;
  private environment: string;

  constructor() {
    this.cloudWatchClient = new CloudWatchClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.namespace = 'AIPhotobooth';
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Send custom metrics to CloudWatch
   */
  async putMetric(metric: MetricData): Promise<void> {
    try {
      const metricDatum: MetricDatum = {
        MetricName: metric.metricName,
        Value: metric.value,
        Unit: metric.unit,
        Timestamp: metric.timestamp || new Date(),
        Dimensions: metric.dimensions ? Object.entries(metric.dimensions).map(([name, value]) => ({
          Name: name,
          Value: value,
        })) : undefined,
      };

      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [metricDatum],
      });

      await this.cloudWatchClient.send(command);

      logger.debug('Metric sent to CloudWatch', {
        metricName: metric.metricName,
        value: metric.value,
        unit: metric.unit,
        dimensions: metric.dimensions,
      });
    } catch (error) {
      logger.error('Failed to send metric to CloudWatch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        metricName: metric.metricName,
        value: metric.value,
      });
    }
  }

  /**
   * Send multiple metrics in a batch
   */
  async putMetrics(metrics: MetricData[]): Promise<void> {
    try {
      const metricData: MetricDatum[] = metrics.map(metric => ({
        MetricName: metric.metricName,
        Value: metric.value,
        Unit: metric.unit,
        Timestamp: metric.timestamp || new Date(),
        Dimensions: metric.dimensions ? Object.entries(metric.dimensions).map(([name, value]) => ({
          Name: name,
          Value: value,
        })) : undefined,
      }));

      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: metricData,
      });

      await this.cloudWatchClient.send(command);

      logger.debug('Batch metrics sent to CloudWatch', {
        count: metrics.length,
        metrics: metrics.map(m => ({ name: m.metricName, value: m.value })),
      });
    } catch (error) {
      logger.error('Failed to send batch metrics to CloudWatch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: metrics.length,
      });
    }
  }

  /**
   * Record processing metrics
   */
  async recordProcessingMetrics(metrics: ProcessingMetrics): Promise<void> {
    const baseMetrics: MetricData[] = [
      {
        metricName: 'ProcessingTime',
        value: metrics.processingTimeMs,
        unit: 'Milliseconds',
        dimensions: {
          Environment: this.environment,
          ThemeId: metrics.themeId || 'unknown',
        },
      },
      {
        metricName: 'ProcessingRequests',
        value: 1,
        unit: 'Count',
        dimensions: {
          Environment: this.environment,
          Status: metrics.success ? 'Success' : 'Failed',
          ThemeId: metrics.themeId || 'unknown',
        },
      },
    ];

    // Add success rate metrics
    baseMetrics.push({
      metricName: 'ProcessingSuccessRate',
      value: metrics.success ? 100 : 0,
      unit: 'Percent',
      dimensions: {
        Environment: this.environment,
        ThemeId: metrics.themeId || 'unknown',
      },
    });

    // Add error type metric if processing failed
    if (!metrics.success && metrics.errorType) {
      baseMetrics.push({
        metricName: 'ProcessingErrors',
        value: 1,
        unit: 'Count',
        dimensions: {
          Environment: this.environment,
          ErrorType: metrics.errorType,
          ThemeId: metrics.themeId || 'unknown',
        },
      });
    }

    // Add image size metric if available
    if (metrics.imageSize) {
      baseMetrics.push({
        metricName: 'ImageSize',
        value: metrics.imageSize,
        unit: 'Bytes',
        dimensions: {
          Environment: this.environment,
          ThemeId: metrics.themeId || 'unknown',
        },
      });
    }

    await this.putMetrics(baseMetrics);
  }

  /**
   * Record API metrics
   */
  async recordApiMetrics(endpoint: string, method: string, statusCode: number, responseTimeMs: number): Promise<void> {
    const metrics: MetricData[] = [
      {
        metricName: 'ApiRequests',
        value: 1,
        unit: 'Count',
        dimensions: {
          Environment: this.environment,
          Endpoint: endpoint,
          Method: method,
          StatusCode: statusCode.toString(),
        },
      },
      {
        metricName: 'ApiResponseTime',
        value: responseTimeMs,
        unit: 'Milliseconds',
        dimensions: {
          Environment: this.environment,
          Endpoint: endpoint,
          Method: method,
        },
      },
    ];

    // Add error metrics for 4xx and 5xx responses
    if (statusCode >= 400) {
      metrics.push({
        metricName: 'ApiErrors',
        value: 1,
        unit: 'Count',
        dimensions: {
          Environment: this.environment,
          Endpoint: endpoint,
          Method: method,
          StatusCode: statusCode.toString(),
          ErrorClass: statusCode >= 500 ? 'ServerError' : 'ClientError',
        },
      });
    }

    await this.putMetrics(metrics);
  }

  /**
   * Record system health metrics
   */
  async recordHealthMetrics(memoryUsageMB: number, cpuUsagePercent?: number): Promise<void> {
    const metrics: MetricData[] = [
      {
        metricName: 'MemoryUsage',
        value: memoryUsageMB,
        unit: 'Bytes',
        dimensions: {
          Environment: this.environment,
        },
      },
    ];

    if (cpuUsagePercent !== undefined) {
      metrics.push({
        metricName: 'CpuUsage',
        value: cpuUsagePercent,
        unit: 'Percent',
        dimensions: {
          Environment: this.environment,
        },
      });
    }

    await this.putMetrics(metrics);
  }

  /**
   * Record business metrics
   */
  async recordBusinessMetrics(dailyProcessedImages: number, activeUsers: number): Promise<void> {
    const metrics: MetricData[] = [
      {
        metricName: 'DailyProcessedImages',
        value: dailyProcessedImages,
        unit: 'Count',
        dimensions: {
          Environment: this.environment,
        },
      },
      {
        metricName: 'ActiveUsers',
        value: activeUsers,
        unit: 'Count',
        dimensions: {
          Environment: this.environment,
        },
      },
    ];

    await this.putMetrics(metrics);
  }
}

export const monitoringService = new MonitoringService();