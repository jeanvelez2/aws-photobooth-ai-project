import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from '../utils/logger.js';

const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });

export class MetricsService {
  private namespace = 'AI-Photobooth';

  async recordProcessingTime(timeMs: number): Promise<void> {
    await this.putMetric('ProcessingTime', timeMs, 'Milliseconds');
  }

  async recordSuccessRate(rate: number): Promise<void> {
    await this.putMetric('SuccessRate', rate, 'Percent');
  }

  async recordErrorRate(rate: number): Promise<void> {
    await this.putMetric('ErrorRate', rate, 'Percent');
  }

  async recordJobCount(count: number, status: string): Promise<void> {
    await this.putMetric('JobCount', count, 'Count', [
      { Name: 'Status', Value: status }
    ]);
  }

  async recordMetric(
    metricName: string, 
    value: number, 
    unit: string, 
    dimensions?: Array<{ Name: string; Value: string }>
  ): Promise<void> {
    await this.putMetric(metricName, value, unit, dimensions);
  }

  private async putMetric(
    metricName: string, 
    value: number, 
    unit: string, 
    dimensions?: Array<{ Name: string; Value: string }>
  ): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;

    try {
      await cloudWatch.send(new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [{
          MetricName: metricName,
          Value: value,
          Unit: unit as any,
          Timestamp: new Date(),
          Dimensions: dimensions
        }]
      }));
    } catch (error) {
      logger.error('Failed to put CloudWatch metric:', error);
    }
  }
}

export const metricsService = new MetricsService();