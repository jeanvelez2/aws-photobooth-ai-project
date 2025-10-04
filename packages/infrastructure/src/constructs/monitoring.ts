import { Construct } from 'constructs';
import { Alarm, Metric, Dashboard, GraphWidget } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Duration } from 'aws-cdk-lib';

export interface MonitoringProps {
  environment: string;
  alertEmail?: string;
}

export class Monitoring extends Construct {
  public readonly alarmTopic: Topic;
  public readonly dashboard: Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    // SNS topic for alerts
    this.alarmTopic = new Topic(this, 'AlarmTopic', {
      displayName: `AI Photobooth Alerts - ${props.environment}`
    });

    if (props.alertEmail) {
      this.alarmTopic.addSubscription(new EmailSubscription(props.alertEmail));
    }

    // CloudWatch Dashboard
    this.dashboard = new Dashboard(this, 'Dashboard', {
      dashboardName: `ai-photobooth-${props.environment}`
    });

    this.createAlarms();
    this.createDashboard();
  }

  private createAlarms(): void {
    // Processing time alarm
    new Alarm(this, 'ProcessingTimeAlarm', {
      metric: new Metric({
        namespace: 'AI-Photobooth',
        metricName: 'ProcessingTime',
        statistic: 'Average'
      }),
      threshold: 10000, // 10 seconds
      evaluationPeriods: 2,
      treatMissingData: undefined
    }).addAlarmAction(new SnsAction(this.alarmTopic));

    // Error rate alarm
    new Alarm(this, 'ErrorRateAlarm', {
      metric: new Metric({
        namespace: 'AI-Photobooth',
        metricName: 'ErrorRate',
        statistic: 'Average'
      }),
      threshold: 5, // 5% error rate
      evaluationPeriods: 3
    }).addAlarmAction(new SnsAction(this.alarmTopic));
  }

  private createDashboard(): void {
    this.dashboard.addWidgets(
      new GraphWidget({
        title: 'Processing Time',
        left: [new Metric({
          namespace: 'AI-Photobooth',
          metricName: 'ProcessingTime'
        })],
        period: Duration.minutes(5)
      }),
      new GraphWidget({
        title: 'Success Rate',
        left: [new Metric({
          namespace: 'AI-Photobooth',
          metricName: 'SuccessRate'
        })],
        period: Duration.minutes(5)
      })
    );
  }
}