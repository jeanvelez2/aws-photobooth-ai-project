import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock AWS SDK
const mockSend = vi.fn();
const mockCloudWatchClient = vi.fn().mockImplementation(() => ({
  send: mockSend,
}));
const mockPutMetricDataCommand = vi.fn();

vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: mockCloudWatchClient,
  PutMetricDataCommand: mockPutMetricDataCommand,
}));

// Import after mocking
const { monitoringService } = await import('./monitoring.js');

describe('MonitoringService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockClear();
    mockPutMetricDataCommand.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('putMetric', () => {
    it('should send a single metric to CloudWatch', async () => {
      mockSend.mockResolvedValueOnce({});

      const metric = {
        metricName: 'TestMetric',
        value: 100,
        unit: 'Count' as const,
        dimensions: { Environment: 'test' },
      };

      await monitoringService.putMetric(metric);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockPutMetricDataCommand).toHaveBeenCalledWith({
        Namespace: 'AIPhotobooth',
        MetricData: [
          expect.objectContaining({
            MetricName: 'TestMetric',
            Value: 100,
            Unit: 'Count',
            Dimensions: [{ Name: 'Environment', Value: 'test' }],
          }),
        ],
      });
    });

    it('should handle CloudWatch errors gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('CloudWatch error'));

      const metric = {
        metricName: 'TestMetric',
        value: 100,
        unit: 'Count' as const,
      };

      // Should not throw
      await expect(monitoringService.putMetric(metric)).resolves.toBeUndefined();
    });
  });

  describe('putMetrics', () => {
    it('should send multiple metrics in a batch', async () => {
      mockSend.mockResolvedValueOnce({});

      const metrics = [
        {
          metricName: 'Metric1',
          value: 100,
          unit: 'Count' as const,
        },
        {
          metricName: 'Metric2',
          value: 200,
          unit: 'Milliseconds' as const,
        },
      ];

      await monitoringService.putMetrics(metrics);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockPutMetricDataCommand).toHaveBeenCalledWith({
        Namespace: 'AIPhotobooth',
        MetricData: expect.arrayContaining([
          expect.objectContaining({ MetricName: 'Metric1', Value: 100 }),
          expect.objectContaining({ MetricName: 'Metric2', Value: 200 }),
        ]),
      });
    });
  });

  describe('recordProcessingMetrics', () => {
    it('should record successful processing metrics', async () => {
      mockSend.mockResolvedValueOnce({});

      const metrics = {
        processingTimeMs: 5000,
        success: true,
        themeId: 'barbarian',
        imageSize: 1024000,
      };

      await monitoringService.recordProcessingMetrics(metrics);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockPutMetricDataCommand).toHaveBeenCalledWith({
        Namespace: 'AIPhotobooth',
        MetricData: expect.arrayContaining([
          expect.objectContaining({
            MetricName: 'ProcessingTime',
            Value: 5000,
            Unit: 'Milliseconds',
          }),
          expect.objectContaining({
            MetricName: 'ProcessingRequests',
            Value: 1,
            Unit: 'Count',
          }),
          expect.objectContaining({
            MetricName: 'ProcessingSuccessRate',
            Value: 100,
            Unit: 'Percent',
          }),
          expect.objectContaining({
            MetricName: 'ImageSize',
            Value: 1024000,
            Unit: 'Bytes',
          }),
        ]),
      });
    });

    it('should record failed processing metrics with error type', async () => {
      mockSend.mockResolvedValueOnce({});

      const metrics = {
        processingTimeMs: 2000,
        success: false,
        errorType: 'NO_FACE_DETECTED',
        themeId: 'greek',
      };

      await monitoringService.recordProcessingMetrics(metrics);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockPutMetricDataCommand).toHaveBeenCalledWith({
        Namespace: 'AIPhotobooth',
        MetricData: expect.arrayContaining([
          expect.objectContaining({
            MetricName: 'ProcessingSuccessRate',
            Value: 0,
            Unit: 'Percent',
          }),
          expect.objectContaining({
            MetricName: 'ProcessingErrors',
            Value: 1,
            Unit: 'Count',
            Dimensions: expect.arrayContaining([
              { Name: 'ErrorType', Value: 'NO_FACE_DETECTED' },
            ]),
          }),
        ]),
      });
    });
  });
});