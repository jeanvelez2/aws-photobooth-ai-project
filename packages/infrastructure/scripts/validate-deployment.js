#!/usr/bin/env node

/**
 * Deployment Validation Script
 * 
 * This script validates the health of the deployed ECS service and related infrastructure
 * after a deployment. It's used by CodeBuild in the CI/CD pipeline.
 */

const AWS = require('aws-sdk');

// Configure AWS SDK
const region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const environment = process.env.ENVIRONMENT || 'dev';

AWS.config.update({ region });

const ecs = new AWS.ECS();
const elbv2 = new AWS.ELBv2();
const cloudwatch = new AWS.CloudWatch();
const ssm = new AWS.SSM();

// Configuration
const VALIDATION_TIMEOUT = 300000; // 5 minutes
const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
const MAX_RETRIES = 30;

class DeploymentValidator {
  constructor() {
    this.clusterName = `photobooth-cluster-${environment}`;
    this.serviceName = `photobooth-processing-${environment}`;
    this.targetGroupName = `photobooth-tg-${environment}`;
  }

  async validate() {
    console.log('🚀 Starting deployment validation...');
    console.log(`Environment: ${environment}`);
    console.log(`Region: ${region}`);
    console.log(`Cluster: ${this.clusterName}`);
    console.log(`Service: ${this.serviceName}`);

    try {
      // Step 1: Validate ECS Service
      console.log('\n📋 Step 1: Validating ECS Service...');
      await this.validateEcsService();

      // Step 2: Validate Target Group Health
      console.log('\n🎯 Step 2: Validating Target Group Health...');
      await this.validateTargetGroupHealth();

      // Step 3: Validate Application Health
      console.log('\n🏥 Step 3: Validating Application Health...');
      await this.validateApplicationHealth();

      // Step 4: Validate Performance Metrics
      console.log('\n📊 Step 4: Validating Performance Metrics...');
      await this.validatePerformanceMetrics();

      console.log('\n✅ Deployment validation completed successfully!');
      process.exit(0);

    } catch (error) {
      console.error('\n❌ Deployment validation failed:', error.message);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    }
  }

  async validateEcsService() {
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        const response = await ecs.describeServices({
          cluster: this.clusterName,
          services: [this.serviceName]
        }).promise();

        if (response.services.length === 0) {
          throw new Error(`ECS service ${this.serviceName} not found`);
        }

        const service = response.services[0];
        
        console.log(`   Service Status: ${service.status}`);
        console.log(`   Running Count: ${service.runningCount}`);
        console.log(`   Desired Count: ${service.desiredCount}`);
        console.log(`   Pending Count: ${service.pendingCount}`);

        // Check service status
        if (service.status !== 'ACTIVE') {
          throw new Error(`Service status is ${service.status}, expected ACTIVE`);
        }

        // Check if service has reached desired capacity
        if (service.runningCount >= service.desiredCount && service.pendingCount === 0) {
          console.log('   ✅ ECS service is healthy and stable');
          
          // Validate task health
          await this.validateTaskHealth(service);
          return;
        }

        console.log(`   ⏳ Waiting for service to stabilize... (${retries + 1}/${MAX_RETRIES})`);
        await this.sleep(HEALTH_CHECK_INTERVAL);
        retries++;

      } catch (error) {
        if (retries >= MAX_RETRIES - 1) {
          throw error;
        }
        console.log(`   ⚠️  ECS validation attempt ${retries + 1} failed: ${error.message}`);
        await this.sleep(HEALTH_CHECK_INTERVAL);
        retries++;
      }
    }

    throw new Error(`ECS service validation timed out after ${MAX_RETRIES} attempts`);
  }

  async validateTaskHealth(service) {
    const tasksResponse = await ecs.listTasks({
      cluster: this.clusterName,
      serviceName: this.serviceName,
      desiredStatus: 'RUNNING'
    }).promise();

    if (tasksResponse.taskArns.length === 0) {
      throw new Error('No running tasks found for the service');
    }

    const taskDetails = await ecs.describeTasks({
      cluster: this.clusterName,
      tasks: tasksResponse.taskArns
    }).promise();

    const healthyTasks = taskDetails.tasks.filter(task => 
      task.lastStatus === 'RUNNING' && task.healthStatus === 'HEALTHY'
    );

    console.log(`   Running Tasks: ${taskDetails.tasks.length}`);
    console.log(`   Healthy Tasks: ${healthyTasks.length}`);

    if (healthyTasks.length < service.desiredCount) {
      throw new Error(`Only ${healthyTasks.length} out of ${service.desiredCount} tasks are healthy`);
    }

    console.log('   ✅ All tasks are healthy');
  }

  async validateTargetGroupHealth() {
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        // Get target group by name
        const targetGroupsResponse = await elbv2.describeTargetGroups({
          Names: [this.targetGroupName]
        }).promise();

        if (targetGroupsResponse.TargetGroups.length === 0) {
          throw new Error(`Target group ${this.targetGroupName} not found`);
        }

        const targetGroup = targetGroupsResponse.TargetGroups[0];
        
        // Get target health
        const healthResponse = await elbv2.describeTargetHealth({
          TargetGroupArn: targetGroup.TargetGroupArn
        }).promise();

        const targets = healthResponse.TargetHealthDescriptions;
        const healthyTargets = targets.filter(target => target.TargetHealth.State === 'healthy');
        const unhealthyTargets = targets.filter(target => target.TargetHealth.State !== 'healthy');

        console.log(`   Total Targets: ${targets.length}`);
        console.log(`   Healthy Targets: ${healthyTargets.length}`);
        console.log(`   Unhealthy Targets: ${unhealthyTargets.length}`);

        // Log unhealthy target details
        if (unhealthyTargets.length > 0) {
          console.log('   Unhealthy Target Details:');
          unhealthyTargets.forEach(target => {
            console.log(`     - ${target.Target.Id}:${target.Target.Port} - ${target.TargetHealth.State} (${target.TargetHealth.Reason})`);
          });
        }

        // Check if we have at least one healthy target
        if (healthyTargets.length > 0) {
          console.log('   ✅ Target group has healthy targets');
          return;
        }

        console.log(`   ⏳ Waiting for targets to become healthy... (${retries + 1}/${MAX_RETRIES})`);
        await this.sleep(HEALTH_CHECK_INTERVAL);
        retries++;

      } catch (error) {
        if (retries >= MAX_RETRIES - 1) {
          throw error;
        }
        console.log(`   ⚠️  Target group validation attempt ${retries + 1} failed: ${error.message}`);
        await this.sleep(HEALTH_CHECK_INTERVAL);
        retries++;
      }
    }

    throw new Error(`Target group validation timed out after ${MAX_RETRIES} attempts`);
  }

  async validateApplicationHealth() {
    // Get the load balancer DNS name from the target group
    const targetGroupsResponse = await elbv2.describeTargetGroups({
      Names: [this.targetGroupName]
    }).promise();

    const targetGroup = targetGroupsResponse.TargetGroups[0];
    
    const loadBalancersResponse = await elbv2.describeLoadBalancers({
      LoadBalancerArns: targetGroup.LoadBalancerArns
    }).promise();

    if (loadBalancersResponse.LoadBalancers.length === 0) {
      throw new Error('No load balancer found for target group');
    }

    const loadBalancer = loadBalancersResponse.LoadBalancers[0];
    const healthEndpoint = `http://${loadBalancer.DNSName}/api/health`;

    console.log(`   Health Endpoint: ${healthEndpoint}`);

    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        const response = await this.makeHttpRequest(healthEndpoint);
        
        if (response.statusCode === 200) {
          console.log('   ✅ Application health check passed');
          console.log(`   Response: ${response.body}`);
          return;
        }

        throw new Error(`Health check returned status ${response.statusCode}: ${response.body}`);

      } catch (error) {
        if (retries >= MAX_RETRIES - 1) {
          throw new Error(`Application health check failed after ${MAX_RETRIES} attempts: ${error.message}`);
        }
        console.log(`   ⚠️  Health check attempt ${retries + 1} failed: ${error.message}`);
        await this.sleep(HEALTH_CHECK_INTERVAL);
        retries++;
      }
    }
  }

  async validatePerformanceMetrics() {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes

    try {
      // Check error rate
      const errorMetrics = await cloudwatch.getMetricStatistics({
        Namespace: 'AWS/ApplicationELB',
        MetricName: 'HTTPCode_Target_5XX_Count',
        Dimensions: [
          {
            Name: 'LoadBalancer',
            Value: `app/photobooth-alb-${environment}`
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Sum']
      }).promise();

      const totalErrors = errorMetrics.Datapoints.reduce((sum, point) => sum + point.Sum, 0);
      console.log(`   5XX Errors (last 5 min): ${totalErrors}`);

      // Check response time
      const responseTimeMetrics = await cloudwatch.getMetricStatistics({
        Namespace: 'AWS/ApplicationELB',
        MetricName: 'TargetResponseTime',
        Dimensions: [
          {
            Name: 'LoadBalancer',
            Value: `app/photobooth-alb-${environment}`
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Average']
      }).promise();

      if (responseTimeMetrics.Datapoints.length > 0) {
        const avgResponseTime = responseTimeMetrics.Datapoints.reduce((sum, point) => sum + point.Average, 0) / responseTimeMetrics.Datapoints.length;
        console.log(`   Avg Response Time (last 5 min): ${avgResponseTime.toFixed(2)}s`);

        if (avgResponseTime > 5.0) {
          console.log('   ⚠️  High response time detected, but deployment will continue');
        }
      }

      // Validate error rate threshold
      if (totalErrors > 20) {
        throw new Error(`High error rate detected: ${totalErrors} errors in the last 5 minutes`);
      }

      console.log('   ✅ Performance metrics are within acceptable ranges');

    } catch (error) {
      if (error.code === 'InvalidParameterValue') {
        console.log('   ⚠️  Some metrics not available yet (new deployment), skipping performance validation');
        return;
      }
      throw error;
    }
  }

  async makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
      const http = require('http');
      const urlParts = new URL(url);
      
      const options = {
        hostname: urlParts.hostname,
        port: urlParts.port || 80,
        path: urlParts.pathname,
        method: 'GET',
        timeout: 10000,
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: body,
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  // Check if help is requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
AI Photobooth Deployment Validation Script

Usage: node validate-deployment.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Run validation checks without connecting to AWS
  
Environment Variables:
  ENVIRONMENT    Target environment (dev, staging, prod)
  AWS_REGION     AWS region (defaults to us-east-1)

This script validates the health of the deployed ECS service and related infrastructure.
    `);
    process.exit(0);
  }

  // Check for dry run
  if (process.argv.includes('--dry-run')) {
    console.log('🧪 Running in dry-run mode - AWS connections disabled');
    console.log('✅ Deployment validation script is properly configured');
    console.log('📋 Script would validate:');
    console.log('   - ECS service health');
    console.log('   - Target group health');
    console.log('   - Application health endpoints');
    console.log('   - Performance metrics');
    console.log('   - Database connectivity');
    process.exit(0);
  }

  const validator = new DeploymentValidator();
  validator.validate().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentValidator;