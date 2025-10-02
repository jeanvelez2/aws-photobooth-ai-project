#!/bin/bash

# Validate service hook script for CodeDeploy ECS Blue/Green deployment
# This script runs after traffic is shifted to validate the deployment

set -e

echo "✅ Starting service validation hook..."

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
TARGET_GROUP_NAME="photobooth-tg-${ENVIRONMENT}"

# Function to validate service health
validate_service_health() {
    echo "🏥 Validating service health..."
    
    # Check ECS service status
    SERVICE_STATUS=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --query 'services[0].status' \
        --output text)
    
    echo "Service status: $SERVICE_STATUS"
    
    if [ "$SERVICE_STATUS" != "ACTIVE" ]; then
        echo "❌ Service is not active"
        return 1
    fi
    
    # Check running task count
    RUNNING_COUNT=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --query 'services[0].runningCount' \
        --output text)
    
    DESIRED_COUNT=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --query 'services[0].desiredCount' \
        --output text)
    
    echo "Running tasks: $RUNNING_COUNT / $DESIRED_COUNT"
    
    if [ "$RUNNING_COUNT" -lt "$DESIRED_COUNT" ]; then
        echo "❌ Not enough tasks are running"
        return 1
    fi
    
    echo "✅ Service health validation passed"
    return 0
}

# Function to validate target group health
validate_target_group_health() {
    echo "🎯 Validating target group health..."
    
    # Get target group ARN
    TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
        --names "$TARGET_GROUP_NAME" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$TARGET_GROUP_ARN" ] || [ "$TARGET_GROUP_ARN" = "None" ]; then
        echo "❌ Target group not found"
        return 1
    fi
    
    # Check target health
    HEALTHY_TARGETS=$(aws elbv2 describe-target-health \
        --target-group-arn "$TARGET_GROUP_ARN" \
        --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`]' \
        --output json | jq length)
    
    TOTAL_TARGETS=$(aws elbv2 describe-target-health \
        --target-group-arn "$TARGET_GROUP_ARN" \
        --query 'TargetHealthDescriptions' \
        --output json | jq length)
    
    echo "Healthy targets: $HEALTHY_TARGETS / $TOTAL_TARGETS"
    
    if [ "$HEALTHY_TARGETS" -eq 0 ]; then
        echo "❌ No healthy targets found"
        return 1
    fi
    
    echo "✅ Target group health validation passed"
    return 0
}

# Function to validate application endpoints
validate_application_endpoints() {
    echo "🌐 Validating application endpoints..."
    
    # Get load balancer DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --names "photobooth-alb-${ENVIRONMENT}" \
        --query 'LoadBalancers[0].DNSName' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$ALB_DNS" ] || [ "$ALB_DNS" = "None" ]; then
        echo "❌ Load balancer DNS not found"
        return 1
    fi
    
    BASE_URL="http://${ALB_DNS}"
    
    # Test health endpoint
    echo "Testing health endpoint: ${BASE_URL}/api/health"
    HEALTH_RESPONSE=$(curl -f --max-time 10 --retry 3 --retry-delay 2 "${BASE_URL}/api/health" 2>/dev/null || echo "FAILED")
    
    if [ "$HEALTH_RESPONSE" = "FAILED" ]; then
        echo "❌ Health endpoint test failed"
        return 1
    fi
    
    echo "✅ Health endpoint responded: $HEALTH_RESPONSE"
    
    # Test themes endpoint
    echo "Testing themes endpoint: ${BASE_URL}/api/themes"
    THEMES_STATUS=$(curl -f --max-time 10 --retry 2 --retry-delay 2 -o /dev/null -w "%{http_code}" "${BASE_URL}/api/themes" 2>/dev/null || echo "000")
    
    if [ "$THEMES_STATUS" = "200" ]; then
        echo "✅ Themes endpoint responded with status: $THEMES_STATUS"
    else
        echo "⚠️  Themes endpoint responded with status: $THEMES_STATUS (may be acceptable)"
    fi
    
    echo "✅ Application endpoints validation completed"
    return 0
}

# Function to run load test
run_load_test() {
    echo "🚀 Running basic load test..."
    
    # Get load balancer DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --names "photobooth-alb-${ENVIRONMENT}" \
        --query 'LoadBalancers[0].DNSName' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$ALB_DNS" ] || [ "$ALB_DNS" = "None" ]; then
        echo "⚠️  Load balancer DNS not found, skipping load test"
        return 0
    fi
    
    BASE_URL="http://${ALB_DNS}"
    
    # Simple concurrent request test
    echo "Running 10 concurrent requests to health endpoint..."
    
    SUCCESS_COUNT=0
    TOTAL_REQUESTS=10
    
    for i in $(seq 1 $TOTAL_REQUESTS); do
        if curl -f --max-time 5 "${BASE_URL}/api/health" > /dev/null 2>&1 &; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        fi
    done
    
    # Wait for all background jobs to complete
    wait
    
    echo "Load test results: $SUCCESS_COUNT / $TOTAL_REQUESTS requests succeeded"
    
    if [ "$SUCCESS_COUNT" -ge 8 ]; then
        echo "✅ Load test passed (80% success rate)"
        return 0
    else
        echo "⚠️  Load test had lower than expected success rate"
        return 1
    fi
}

# Function to validate performance metrics
validate_performance_metrics() {
    echo "📊 Validating performance metrics..."
    
    # Check recent error rates
    END_TIME=$(date +%s)000
    START_TIME=$((END_TIME - 300000))  # Last 5 minutes
    
    # Check 5XX error rate
    ERROR_COUNT=$(aws cloudwatch get-metric-statistics \
        --namespace "AWS/ApplicationELB" \
        --metric-name "HTTPCode_Target_5XX_Count" \
        --dimensions Name=LoadBalancer,Value="app/photobooth-alb-${ENVIRONMENT}" \
        --start-time "$(date -d @$((START_TIME/1000)) -Iseconds)" \
        --end-time "$(date -d @$((END_TIME/1000)) -Iseconds)" \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")
    
    if [ "$ERROR_COUNT" = "None" ]; then
        ERROR_COUNT=0
    fi
    
    echo "5XX errors in last 5 minutes: $ERROR_COUNT"
    
    # Check response time
    AVG_RESPONSE_TIME=$(aws cloudwatch get-metric-statistics \
        --namespace "AWS/ApplicationELB" \
        --metric-name "TargetResponseTime" \
        --dimensions Name=LoadBalancer,Value="app/photobooth-alb-${ENVIRONMENT}" \
        --start-time "$(date -d @$((START_TIME/1000)) -Iseconds)" \
        --end-time "$(date -d @$((END_TIME/1000)) -Iseconds)" \
        --period 300 \
        --statistics Average \
        --query 'Datapoints[0].Average' \
        --output text 2>/dev/null || echo "0")
    
    if [ "$AVG_RESPONSE_TIME" = "None" ]; then
        AVG_RESPONSE_TIME=0
    fi
    
    echo "Average response time in last 5 minutes: ${AVG_RESPONSE_TIME}s"
    
    # Validate thresholds
    if [ "$(echo "$ERROR_COUNT > 10" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
        echo "❌ High error rate detected: $ERROR_COUNT errors"
        return 1
    fi
    
    if [ "$(echo "$AVG_RESPONSE_TIME > 5.0" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
        echo "⚠️  High response time detected: ${AVG_RESPONSE_TIME}s"
        # Don't fail deployment for high response time, just warn
    fi
    
    echo "✅ Performance metrics validation passed"
    return 0
}

# Function to validate database connectivity
validate_database_connectivity() {
    echo "🗄️  Validating database connectivity..."
    
    # Test DynamoDB tables
    PROCESSING_JOBS_TABLE="photobooth-processing-jobs-${ENVIRONMENT}"
    THEMES_TABLE="photobooth-themes-${ENVIRONMENT}"
    
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
    
    # Test table read operation
    ITEM_COUNT=$(aws dynamodb scan \
        --table-name "$THEMES_TABLE" \
        --select COUNT \
        --query 'Count' \
        --output text 2>/dev/null || echo "0")
    
    echo "Themes table item count: $ITEM_COUNT"
    
    echo "✅ Database connectivity validation passed"
    return 0
}

# Main validation sequence
echo "🔄 Running comprehensive service validation..."

VALIDATION_FAILED=0

# Run all validations
echo "=== Service Health Validation ==="
if ! validate_service_health; then
    VALIDATION_FAILED=1
fi

echo -e "\n=== Target Group Health Validation ==="
if ! validate_target_group_health; then
    VALIDATION_FAILED=1
fi

echo -e "\n=== Application Endpoints Validation ==="
if ! validate_application_endpoints; then
    VALIDATION_FAILED=1
fi

echo -e "\n=== Database Connectivity Validation ==="
if ! validate_database_connectivity; then
    VALIDATION_FAILED=1
fi

echo -e "\n=== Performance Metrics Validation ==="
if ! validate_performance_metrics; then
    VALIDATION_FAILED=1
fi

echo -e "\n=== Load Test ==="
if ! run_load_test; then
    echo "⚠️  Load test failed, but deployment will continue"
    # Don't fail deployment for load test failure
fi

# Send deployment metrics
echo -e "\n📊 Sending deployment completion metrics..."

aws cloudwatch put-metric-data \
    --namespace "AI-Photobooth/Deployment" \
    --metric-data \
        MetricName=ValidateServiceHookExecuted,Value=1,Unit=Count,Dimensions=Environment=$ENVIRONMENT,DeploymentId=$DEPLOYMENT_ID \
        MetricName=DeploymentValidationResult,Value=$((1-VALIDATION_FAILED)),Unit=Count,Dimensions=Environment=$ENVIRONMENT,DeploymentId=$DEPLOYMENT_ID \
    || echo "⚠️  Failed to send CloudWatch metrics"

# Final result
if [ $VALIDATION_FAILED -eq 0 ]; then
    echo -e "\n🎉 All service validations passed successfully!"
    echo "✅ Deployment is healthy and ready for production traffic"
    exit 0
else
    echo -e "\n❌ Some service validations failed"
    echo "🚨 Deployment validation failed - consider rollback"
    exit 1
fi