#!/bin/bash

# Pre-traffic hook script for CodeDeploy ECS Blue/Green deployment
# This script runs before traffic is shifted to the new task set

set -e

echo "🔄 Starting pre-traffic hook..."

# Get deployment information from environment variables
DEPLOYMENT_ID=${DEPLOYMENT_ID:-"unknown"}
APPLICATION_NAME=${APPLICATION_NAME:-"ai-photobooth"}
DEPLOYMENT_GROUP_NAME=${DEPLOYMENT_GROUP_NAME:-"ai-photobooth-dg"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}

echo "Deployment ID: $DEPLOYMENT_ID"
echo "Application: $APPLICATION_NAME"
echo "Deployment Group: $DEPLOYMENT_GROUP_NAME"
echo "Environment: $ENVIRONMENT"

# Wait for new tasks to be running and healthy
echo "⏳ Waiting for new tasks to be running and healthy..."

# Get the ECS cluster and service names
CLUSTER_NAME="photobooth-cluster-${ENVIRONMENT}"
SERVICE_NAME="photobooth-processing-${ENVIRONMENT}"

# Function to check task health
check_task_health() {
    local cluster=$1
    local service=$2
    
    echo "Checking task health for service: $service in cluster: $cluster"
    
    # Get running tasks
    TASK_ARNS=$(aws ecs list-tasks \
        --cluster "$cluster" \
        --service-name "$service" \
        --desired-status RUNNING \
        --query 'taskArns' \
        --output text)
    
    if [ -z "$TASK_ARNS" ] || [ "$TASK_ARNS" = "None" ]; then
        echo "❌ No running tasks found"
        return 1
    fi
    
    # Check task details
    TASK_DETAILS=$(aws ecs describe-tasks \
        --cluster "$cluster" \
        --tasks $TASK_ARNS \
        --query 'tasks[?lastStatus==`RUNNING` && healthStatus==`HEALTHY`]' \
        --output json)
    
    HEALTHY_COUNT=$(echo "$TASK_DETAILS" | jq length)
    TOTAL_TASKS=$(echo "$TASK_ARNS" | wc -w)
    
    echo "Healthy tasks: $HEALTHY_COUNT / $TOTAL_TASKS"
    
    if [ "$HEALTHY_COUNT" -gt 0 ]; then
        echo "✅ Found $HEALTHY_COUNT healthy tasks"
        return 0
    else
        echo "⚠️  No healthy tasks found yet"
        return 1
    fi
}

# Wait for tasks to be healthy (up to 5 minutes)
MAX_ATTEMPTS=30
ATTEMPT=1
SLEEP_INTERVAL=10

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS: Checking task health..."
    
    if check_task_health "$CLUSTER_NAME" "$SERVICE_NAME"; then
        echo "✅ Tasks are healthy, proceeding with deployment"
        break
    fi
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "❌ Tasks did not become healthy within the timeout period"
        exit 1
    fi
    
    echo "Waiting ${SLEEP_INTERVAL}s before next check..."
    sleep $SLEEP_INTERVAL
    ATTEMPT=$((ATTEMPT + 1))
done

# Perform additional pre-traffic validations
echo "🔍 Performing additional pre-traffic validations..."

# Check if the application responds to health checks
echo "Checking application health endpoint..."

# Get the load balancer DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names "photobooth-alb-${ENVIRONMENT}" \
    --query 'LoadBalancers[0].DNSName' \
    --output text 2>/dev/null || echo "")

if [ -n "$ALB_DNS" ] && [ "$ALB_DNS" != "None" ]; then
    HEALTH_URL="http://${ALB_DNS}/api/health"
    echo "Testing health endpoint: $HEALTH_URL"
    
    # Try health check with timeout
    if curl -f --max-time 10 --retry 3 --retry-delay 5 "$HEALTH_URL" > /dev/null 2>&1; then
        echo "✅ Health endpoint is responding"
    else
        echo "⚠️  Health endpoint not responding yet (this may be normal for new deployments)"
    fi
else
    echo "⚠️  Could not determine load balancer DNS name"
fi

# Log deployment metrics
echo "📊 Logging deployment metrics..."

# Send custom CloudWatch metric
aws cloudwatch put-metric-data \
    --namespace "AI-Photobooth/Deployment" \
    --metric-data \
        MetricName=PreTrafficHookExecuted,Value=1,Unit=Count,Dimensions=Environment=$ENVIRONMENT,DeploymentId=$DEPLOYMENT_ID \
    || echo "⚠️  Failed to send CloudWatch metric"

echo "✅ Pre-traffic hook completed successfully"
exit 0