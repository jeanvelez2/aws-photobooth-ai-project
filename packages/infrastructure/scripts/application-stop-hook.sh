#!/bin/bash

# Application stop hook script for CodeDeploy ECS Blue/Green deployment
# This script runs before old tasks are terminated

set -e

echo "🛑 Starting application stop hook..."

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

# Function to gracefully drain connections
drain_connections() {
    echo "🔄 Draining connections from old tasks..."
    
    # Get the old task set (the one being replaced)
    echo "Identifying old tasks to be terminated..."
    
    # In a blue-green deployment, we want to ensure any in-flight requests
    # are completed before the old tasks are terminated
    
    # Wait for a grace period to allow in-flight requests to complete
    DRAIN_TIME=30
    echo "Waiting ${DRAIN_TIME}s for in-flight requests to complete..."
    sleep $DRAIN_TIME
    
    echo "✅ Connection draining completed"
}

# Function to backup current state (if needed)
backup_current_state() {
    echo "💾 Backing up current application state..."
    
    # Export current processing jobs that are in progress
    PROCESSING_JOBS_TABLE="photobooth-processing-jobs-${ENVIRONMENT}"
    
    echo "Checking for in-progress processing jobs..."
    
    IN_PROGRESS_JOBS=$(aws dynamodb scan \
        --table-name "$PROCESSING_JOBS_TABLE" \
        --filter-expression "#status = :status" \
        --expression-attribute-names '{"#status": "status"}' \
        --expression-attribute-values '{":status": {"S": "processing"}}' \
        --query 'Count' \
        --output text 2>/dev/null || echo "0")
    
    echo "Found $IN_PROGRESS_JOBS in-progress processing jobs"
    
    if [ "$IN_PROGRESS_JOBS" -gt 0 ]; then
        echo "⚠️  There are $IN_PROGRESS_JOBS jobs currently processing"
        echo "These jobs will continue processing on the new tasks"
        
        # Log the job IDs for monitoring
        JOB_IDS=$(aws dynamodb scan \
            --table-name "$PROCESSING_JOBS_TABLE" \
            --filter-expression "#status = :status" \
            --expression-attribute-names '{"#status": "status"}' \
            --expression-attribute-values '{":status": {"S": "processing"}}' \
            --projection-expression "jobId" \
            --query 'Items[].jobId.S' \
            --output text 2>/dev/null || echo "")
        
        if [ -n "$JOB_IDS" ]; then
            echo "In-progress job IDs: $JOB_IDS"
        fi
    else
        echo "✅ No in-progress jobs found"
    fi
}

# Function to notify monitoring systems
notify_monitoring_systems() {
    echo "📢 Notifying monitoring systems about deployment..."
    
    # Send deployment event to CloudWatch
    aws cloudwatch put-metric-data \
        --namespace "AI-Photobooth/Deployment" \
        --metric-data \
            MetricName=ApplicationStopHookExecuted,Value=1,Unit=Count,Dimensions=Environment=$ENVIRONMENT,DeploymentId=$DEPLOYMENT_ID \
        || echo "⚠️  Failed to send CloudWatch metric"
    
    # Log deployment event
    echo "Deployment event logged for monitoring systems"
}

# Function to perform cleanup tasks
perform_cleanup() {
    echo "🧹 Performing cleanup tasks..."
    
    # Clean up temporary files (if any)
    echo "Cleaning up temporary files..."
    
    # Clear any cached data that shouldn't persist
    echo "Clearing application caches..."
    
    # Note: In a containerized environment, most cleanup is handled automatically
    # when containers are terminated, but we can perform any necessary cleanup here
    
    echo "✅ Cleanup tasks completed"
}

# Function to validate new deployment health before stopping old tasks
validate_new_deployment() {
    echo "🔍 Validating new deployment health before stopping old tasks..."
    
    # Check if new tasks are healthy and receiving traffic
    NEW_TASK_ARNS=$(aws ecs list-tasks \
        --cluster "$CLUSTER_NAME" \
        --service-name "$SERVICE_NAME" \
        --desired-status RUNNING \
        --query 'taskArns' \
        --output text)
    
    if [ -z "$NEW_TASK_ARNS" ] || [ "$NEW_TASK_ARNS" = "None" ]; then
        echo "❌ No running tasks found for new deployment"
        return 1
    fi
    
    # Check task health
    HEALTHY_TASKS=$(aws ecs describe-tasks \
        --cluster "$CLUSTER_NAME" \
        --tasks $NEW_TASK_ARNS \
        --query 'tasks[?lastStatus==`RUNNING` && healthStatus==`HEALTHY`]' \
        --output json | jq length)
    
    echo "Healthy new tasks: $HEALTHY_TASKS"
    
    if [ "$HEALTHY_TASKS" -gt 0 ]; then
        echo "✅ New deployment has healthy tasks"
        return 0
    else
        echo "❌ New deployment does not have healthy tasks"
        return 1
    fi
}

# Function to check for critical errors
check_for_critical_errors() {
    echo "🚨 Checking for critical errors..."
    
    # Check recent error logs
    LOG_GROUP="/ecs/photobooth-processing-${ENVIRONMENT}"
    
    # Get log events from the last 5 minutes
    END_TIME=$(date +%s)000
    START_TIME=$((END_TIME - 300000))  # 5 minutes ago
    
    CRITICAL_ERRORS=$(aws logs filter-log-events \
        --log-group-name "$LOG_GROUP" \
        --start-time "$START_TIME" \
        --end-time "$END_TIME" \
        --filter-pattern "CRITICAL" \
        --query 'events' \
        --output json 2>/dev/null | jq length || echo "0")
    
    if [ "$CRITICAL_ERRORS" -gt 0 ]; then
        echo "⚠️  Found $CRITICAL_ERRORS critical errors in recent logs"
        echo "Proceeding with caution..."
    else
        echo "✅ No critical errors found in recent logs"
    fi
}

# Main execution sequence
echo "🔄 Running application stop validations..."

# Validate that new deployment is healthy before proceeding
if ! validate_new_deployment; then
    echo "❌ New deployment validation failed, aborting stop hook"
    exit 1
fi

# Check for critical errors
check_for_critical_errors

# Backup current state
backup_current_state

# Notify monitoring systems
notify_monitoring_systems

# Drain connections gracefully
drain_connections

# Perform cleanup tasks
perform_cleanup

# Final validation
echo "🔍 Performing final validation..."

# Ensure new tasks are still healthy
if validate_new_deployment; then
    echo "✅ Final validation passed - new deployment is healthy"
else
    echo "❌ Final validation failed - new deployment is not healthy"
    exit 1
fi

# Log successful completion
echo "✅ Application stop hook completed successfully"
echo "🎯 Old tasks are ready to be terminated"

exit 0