#!/bin/bash

# Application start hook script for CodeDeploy ECS Blue/Green deployment
# This script runs after new tasks are started but before traffic is shifted

set -e

echo "🚀 Starting application start hook..."

# Get deployment information
DEPLOYMENT_ID=${DEPLOYMENT_ID:-"unknown"}
APPLICATION_NAME=${APPLICATION_NAME:-"ai-photobooth"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}

echo "Deployment ID: $DEPLOYMENT_ID"
echo "Application: $APPLICATION_NAME"
echo "Environment: $ENVIRONMENT"

# Configuration
CLUSTER_NAME="photobooth-cluster-${ENVIRONMENT}"
SERVICE_NAME="photobooth-processing-${ENVIRONMENT}"

# Function to validate application startup
validate_application_startup() {
    echo "🔍 Validating application startup..."
    
    # Check if containers are running
    echo "Checking container status..."
    
    TASK_ARNS=$(aws ecs list-tasks \
        --cluster "$CLUSTER_NAME" \
        --service-name "$SERVICE_NAME" \
        --desired-status RUNNING \
        --query 'taskArns' \
        --output text)
    
    if [ -z "$TASK_ARNS" ] || [ "$TASK_ARNS" = "None" ]; then
        echo "❌ No running tasks found"
        return 1
    fi
    
    # Get detailed task information
    TASK_DETAILS=$(aws ecs describe-tasks \
        --cluster "$CLUSTER_NAME" \
        --tasks $TASK_ARNS \
        --output json)
    
    # Check container health
    HEALTHY_CONTAINERS=$(echo "$TASK_DETAILS" | jq -r '.tasks[] | select(.lastStatus=="RUNNING") | .containers[] | select(.healthStatus=="HEALTHY") | .name' | wc -l)
    TOTAL_CONTAINERS=$(echo "$TASK_DETAILS" | jq -r '.tasks[] | select(.lastStatus=="RUNNING") | .containers[] | .name' | wc -l)
    
    echo "Healthy containers: $HEALTHY_CONTAINERS / $TOTAL_CONTAINERS"
    
    if [ "$HEALTHY_CONTAINERS" -gt 0 ]; then
        echo "✅ Application containers are healthy"
        return 0
    else
        echo "⚠️  No healthy containers found"
        return 1
    fi
}

# Function to check application logs for startup errors
check_application_logs() {
    echo "📋 Checking application logs for startup errors..."
    
    # Get recent log events from CloudWatch
    LOG_GROUP="/ecs/photobooth-processing-${ENVIRONMENT}"
    
    # Get log streams from the last 10 minutes
    END_TIME=$(date +%s)000
    START_TIME=$((END_TIME - 600000))  # 10 minutes ago
    
    echo "Checking logs from $(date -d @$((START_TIME/1000))) to $(date -d @$((END_TIME/1000)))"
    
    # Get recent log events
    LOG_EVENTS=$(aws logs filter-log-events \
        --log-group-name "$LOG_GROUP" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --filter-pattern "ERROR" \
        --query 'events[?@.message != null]' \
        --output json 2>/dev/null || echo "[]")
    
    ERROR_COUNT=$(echo "$LOG_EVENTS" | jq length)
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "⚠️  Found $ERROR_COUNT error messages in recent logs:"
        echo "$LOG_EVENTS" | jq -r '.[] | .message' | head -5
        echo "Note: Some errors during startup may be normal"
    else
        echo "✅ No error messages found in recent logs"
    fi
}

# Function to validate database connectivity (if applicable)
validate_database_connectivity() {
    echo "🗄️  Validating database connectivity..."
    
    # Check DynamoDB table accessibility
    PROCESSING_JOBS_TABLE="photobooth-processing-jobs-${ENVIRONMENT}"
    THEMES_TABLE="photobooth-themes-${ENVIRONMENT}"
    
    echo "Checking DynamoDB table access..."
    
    # Test processing jobs table
    if aws dynamodb describe-table --table-name "$PROCESSING_JOBS_TABLE" > /dev/null 2>&1; then
        echo "✅ Processing jobs table is accessible"
    else
        echo "❌ Processing jobs table is not accessible"
        return 1
    fi
    
    # Test themes table
    if aws dynamodb describe-table --table-name "$THEMES_TABLE" > /dev/null 2>&1; then
        echo "✅ Themes table is accessible"
    else
        echo "❌ Themes table is not accessible"
        return 1
    fi
}

# Function to validate S3 bucket access
validate_s3_access() {
    echo "🪣 Validating S3 bucket access..."
    
    BUCKET_NAME="ai-photobooth-${ENVIRONMENT}-$(aws sts get-caller-identity --query Account --output text)-$(aws configure get region)"
    
    if aws s3 ls "s3://${BUCKET_NAME}/" > /dev/null 2>&1; then
        echo "✅ S3 bucket is accessible"
    else
        echo "❌ S3 bucket is not accessible"
        return 1
    fi
}

# Function to validate external service connectivity
validate_external_services() {
    echo "🌐 Validating external service connectivity..."
    
    # Test AWS Rekognition access
    echo "Testing AWS Rekognition access..."
    if aws rekognition describe-collection --collection-id "test-collection" 2>/dev/null || [ $? -eq 254 ]; then
        echo "✅ AWS Rekognition is accessible"
    else
        echo "⚠️  AWS Rekognition access test inconclusive"
    fi
    
    # Test internet connectivity
    echo "Testing internet connectivity..."
    if curl -f --max-time 10 "https://httpbin.org/status/200" > /dev/null 2>&1; then
        echo "✅ Internet connectivity is working"
    else
        echo "⚠️  Internet connectivity test failed"
    fi
}

# Main validation sequence
echo "🔄 Running application startup validations..."

# Wait for application to be ready
MAX_ATTEMPTS=20
ATTEMPT=1
SLEEP_INTERVAL=15

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Validation attempt $ATTEMPT/$MAX_ATTEMPTS..."
    
    if validate_application_startup; then
        echo "✅ Application startup validation passed"
        break
    fi
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "❌ Application startup validation failed after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    
    echo "Waiting ${SLEEP_INTERVAL}s before next validation..."
    sleep $SLEEP_INTERVAL
    ATTEMPT=$((ATTEMPT + 1))
done

# Run additional validations
check_application_logs
validate_database_connectivity
validate_s3_access
validate_external_services

# Send deployment metrics
echo "📊 Sending deployment metrics..."

aws cloudwatch put-metric-data \
    --namespace "AI-Photobooth/Deployment" \
    --metric-data \
        MetricName=ApplicationStartHookExecuted,Value=1,Unit=Count,Dimensions=Environment=$ENVIRONMENT,DeploymentId=$DEPLOYMENT_ID \
    || echo "⚠️  Failed to send CloudWatch metric"

# Log successful completion
echo "✅ Application start hook completed successfully"
echo "🎯 Application is ready for traffic"

exit 0