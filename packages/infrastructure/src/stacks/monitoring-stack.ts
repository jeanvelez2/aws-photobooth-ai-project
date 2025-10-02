import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface MonitoringStackProps extends cdk.StackProps {
  environmentConfig: EnvironmentConfig;
  clusterName: string;
  serviceName: string;
  loadBalancerArn: string;
  targetGroupArn: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  private readonly environmentConfig: EnvironmentConfig;
  private readonly namespace = 'AIPhotobooth';

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);
    
    this.environmentConfig = props.environmentConfig;

    // Create SNS topic for alerts
    this.alarmTopic = this.createAlarmTopic();

    // Create CloudWatch alarms
    this.createAlarms(props);

    // Create monitoring dashboard
    this.dashboard = this.createDashboard(props);

    // Create log insights queries
    this.createLogInsights();
  }

  private createAlarmTopic(): sns.Topic {
    const topic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `photobooth-alarms-${this.environmentConfig.environment}`,
      displayName: 'AI Photobooth Monitoring Alarms',
    });

    // Add email subscription if configured
    if (this.environmentConfig.monitoring.alarmEmail) {
      topic.addSubscription(
        new snsSubscriptions.EmailSubscription(this.environmentConfig.monitoring.alarmEmail)
      );
    }

    return topic;
  }

  private createAlarms(props: MonitoringStackProps): void {
    // Processing time alarm
    new cloudwatch.Alarm(this, 'ProcessingTimeAlarm', {
      alarmName: `photobooth-processing-time-${this.environmentConfig.environment}`,
      alarmDescription: 'Processing time exceeds threshold',
      metric: new cloudwatch.Metric({
        namespace: this.namespace,
        metricName: 'ProcessingTime',
        dimensionsMap: {
          Environment: this.environmentConfig.environment,
        },
        statistic: 'Average',
      }),
      threshold: 15000, // 15 seconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // Error rate alarm
    new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
      alarmName: `photobooth-error-rate-${this.environmentConfig.environment}`,
      alarmDescription: 'Error rate exceeds 5%',
      metric: new cloudwatch.MathExpression({
        expression: '(errors / requests) * 100',
        usingMetrics: {
          errors: new cloudwatch.Metric({
            namespace: this.namespace,
            metricName: 'ProcessingErrors',
            dimensionsMap: {
              Environment: this.environmentConfig.environment,
            },
            statistic: 'Sum',
          }),
          requests: new cloudwatch.Metric({
            namespace: this.namespace,
            metricName: 'ProcessingRequests',
            dimensionsMap: {
              Environment: this.environmentConfig.environment,
            },
            statistic: 'Sum',
          }),
        },
      }),
      threshold: 5, // 5%
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // API response time alarm
    new cloudwatch.Alarm(this, 'ApiResponseTimeAlarm', {
      alarmName: `photobooth-api-response-time-${this.environmentConfig.environment}`,
      alarmDescription: 'API response time exceeds 1 second',
      metric: new cloudwatch.Metric({
        namespace: this.namespace,
        metricName: 'ApiResponseTime',
        dimensionsMap: {
          Environment: this.environmentConfig.environment,
        },
        statistic: 'Average',
      }),
      threshold: 1000, // 1 second
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // Memory usage alarm
    new cloudwatch.Alarm(this, 'MemoryUsageAlarm', {
      alarmName: `photobooth-memory-usage-${this.environmentConfig.environment}`,
      alarmDescription: 'Memory usage exceeds 80%',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryUtilization',
        dimensionsMap: {
          ServiceName: props.serviceName,
          ClusterName: props.clusterName,
        },
        statistic: 'Average',
      }),
      threshold: 80, // 80%
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // CPU usage alarm
    new cloudwatch.Alarm(this, 'CpuUsageAlarm', {
      alarmName: `photobooth-cpu-usage-${this.environmentConfig.environment}`,
      alarmDescription: 'CPU usage exceeds 80%',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ServiceName: props.serviceName,
          ClusterName: props.clusterName,
        },
        statistic: 'Average',
      }),
      threshold: 80, // 80%
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // ALB target health alarm
    new cloudwatch.Alarm(this, 'TargetHealthAlarm', {
      alarmName: `photobooth-target-health-${this.environmentConfig.environment}`,
      alarmDescription: 'Unhealthy targets detected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'UnHealthyHostCount',
        dimensionsMap: {
          TargetGroup: props.targetGroupArn.split('/').slice(-3).join('/'),
          LoadBalancer: props.loadBalancerArn.split('/').slice(-3).join('/'),
        },
        statistic: 'Average',
      }),
      threshold: 0,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // 5xx error rate alarm
    new cloudwatch.Alarm(this, 'Http5xxAlarm', {
      alarmName: `photobooth-5xx-errors-${this.environmentConfig.environment}`,
      alarmDescription: '5xx error rate exceeds threshold',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_5XX_Count',
        dimensionsMap: {
          TargetGroup: props.targetGroupArn.split('/').slice(-3).join('/'),
          LoadBalancer: props.loadBalancerArn.split('/').slice(-3).join('/'),
        },
        statistic: 'Sum',
      }),
      threshold: 10, // 10 errors in 5 minutes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }

  private createDashboard(props: MonitoringStackProps): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'MonitoringDashboard', {
      dashboardName: `photobooth-monitoring-${this.environmentConfig.environment}`,
    });

    // Application Performance Row
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# AI Photobooth Monitoring Dashboard\n## Application Performance',
        width: 24,
        height: 2,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Processing Time',
        left: [
          new cloudwatch.Metric({
            namespace: this.namespace,
            metricName: 'ProcessingTime',
            dimensionsMap: {
              Environment: this.environmentConfig.environment,
            },
            statistic: 'Average',
            label: 'Avg Processing Time',
          }),
          new cloudwatch.Metric({
            namespace: this.namespace,
            metricName: 'ProcessingTime',
            dimensionsMap: {
              Environment: this.environmentConfig.environment,
            },
            statistic: 'p95',
            label: 'P95 Processing Time',
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Success Rate',
        left: [
          new cloudwatch.Metric({
            namespace: this.namespace,
            metricName: 'ProcessingSuccessRate',
            dimensionsMap: {
              Environment: this.environmentConfig.environment,
            },
            statistic: 'Average',
            label: 'Success Rate %',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    return dashboard;
  }

  private createLogInsights(): void {
    // Create log group for application logs if it doesn't exist
    new logs.LogGroup(this, 'ApplicationLogGroup', {
      logGroupName: `/ecs/photobooth-processing-${this.environmentConfig.environment}`,
      retention: this.environmentConfig.logRetentionDays as logs.RetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Log insights queries output for reference
    new cdk.CfnOutput(this, 'LogInsightsQueries', {
      value: JSON.stringify({
        'Error Analysis': 'fields @timestamp, level, message, error | filter level = "error" | sort @timestamp desc | limit 100',
        'Processing Performance': 'fields @timestamp, message, processingTime | filter message like /processing/ | stats avg(processingTime), max(processingTime), min(processingTime) by bin(5m)',
        'API Endpoints': 'fields @timestamp, endpoint, method, statusCode, responseTime | filter endpoint exists | stats count() by endpoint, statusCode',
        'Correlation Tracking': 'fields @timestamp, correlationId, message | filter correlationId = "CORRELATION_ID_HERE" | sort @timestamp',
      }),
      description: 'CloudWatch Log Insights queries for monitoring',
    });
  }
}