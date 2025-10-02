#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PhotoboothStack } from './stacks/photobooth-stack';
import { MonitoringStack } from './stacks/monitoring-stack';
import { CicdStack } from './stacks/cicd-stack';
import { EcrStack } from './stacks/ecr-stack';
import { getEnvironmentConfig } from './config/environments';

// Declare process for Node.js environment
declare const process: any;

const app = new cdk.App();

// Get environment name from context or environment variable
const environmentName = app.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'dev';
const environmentConfig = getEnvironmentConfig(environmentName);

// Get AWS environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: environmentConfig.region,
};

// Create ECR repositories first
const ecrStack = new EcrStack(app, `EcrStack-${environmentName}`, {
  env,
  environmentConfig,
  description: `AI Photobooth ECR repositories - ${environmentName}`,
  tags: {
    Project: 'AI-Photobooth',
    Environment: environmentName,
    ManagedBy: 'CDK',
    Component: 'ECR',
  },
});

// Create the main photobooth stack
const photoboothStack = new PhotoboothStack(app, `PhotoboothStack-${environmentName}`, {
  env,
  environmentConfig,
  description: `AI Photobooth application infrastructure - ${environmentName}`,
  tags: {
    Project: 'AI-Photobooth',
    Environment: environmentName,
    ManagedBy: 'CDK',
  },
});

// Create monitoring stack if detailed monitoring is enabled
if (environmentConfig.monitoring.enableDetailedMonitoring) {
  new MonitoringStack(app, `PhotoboothMonitoring-${environmentName}`, {
    env,
    environmentConfig,
    clusterName: photoboothStack.cluster.clusterName,
    serviceName: photoboothStack.service.serviceName,
    loadBalancerArn: photoboothStack.loadBalancer.loadBalancerArn,
    targetGroupArn: photoboothStack.targetGroup.targetGroupArn,
    description: `AI Photobooth monitoring and observability - ${environmentName}`,
    tags: {
      Project: 'AI-Photobooth',
      Environment: environmentName,
      ManagedBy: 'CDK',
      Component: 'Monitoring',
    },
  });
}

// Create CI/CD pipeline stack
new CicdStack(app, `PhotoboothCicd-${environmentName}`, {
  env,
  environmentConfig,
  ecsClusterName: photoboothStack.cluster.clusterName,
  ecsServiceName: photoboothStack.service.serviceName,
  targetEnvironment: environmentName,
  description: `AI Photobooth CI/CD pipeline - ${environmentName}`,
  tags: {
    Project: 'AI-Photobooth',
    Environment: environmentName,
    ManagedBy: 'CDK',
    Component: 'CICD',
  },
});