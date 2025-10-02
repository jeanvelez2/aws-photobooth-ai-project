# AI Photobooth CI/CD Pipeline

This document describes the comprehensive CI/CD pipeline implementation for the AI Photobooth application using AWS services.

## Overview

The CI/CD pipeline provides automated deployment with blue-green deployment strategy, comprehensive validation, and monitoring. It includes:

- **CodePipeline**: Orchestrates the entire deployment process
- **CodeBuild**: Builds Docker images for frontend and backend
- **CodeDeploy**: Manages blue-green deployments to ECS
- **Parameter Store**: Manages environment configuration
- **Secrets Manager**: Securely stores sensitive credentials
- **EventBridge**: Orchestrates deployment events
- **X-Ray**: Provides deployment tracing and debugging
- **Lambda**: Performs deployment validation

## Architecture

```
GitHub → CodePipeline → CodeBuild → CodeDeploy → ECS Fargate
    ↓         ↓           ↓           ↓          ↓
Parameter  EventBridge  ECR      Lambda     CloudWatch
 Store                         Validation   Monitoring
    ↓
Secrets
Manager
```

## Pipeline Stages

### 1. Source Stage
- **Trigger**: GitHub webhook on main branch push
- **Action**: Downloads source code from GitHub repository
- **Artifacts**: Source code archive

### 2. Build Stage (Parallel)
- **Frontend Build**:
  - Installs dependencies with `npm ci`
  - Builds React application
  - Creates Docker image
  - Pushes to ECR repository
  
- **Backend Build**:
  - Installs dependencies with `npm ci`
  - Runs unit tests
  - Builds Node.js application
  - Creates Docker image with GPU support
  - Pushes to ECR repository

### 3. Pre-deployment Validation
- **Health Tests**: Validates application health endpoints
- **Integration Tests**: Runs integration test suite
- **Load Tests**: Performs basic load testing with Artillery.js

### 4. Deploy Stage
- **Blue-Green Deployment**: Uses CodeDeploy for zero-downtime deployment
- **Traffic Shifting**: Gradually shifts traffic from old to new version
- **Rollback**: Automatic rollback on deployment failure

### 5. Post-deployment Validation
- **Lambda Validation**: Custom validation function checks:
  - ECS service health
  - Target group health
  - Application metrics
  - Error rates
- **Integration Tests**: Validates deployed application functionality

## Configuration Management

### Parameter Store Parameters
Located at `/ai-photobooth/{environment}/`:

- `environment`: Target environment name
- `region`: AWS region for deployment
- `log-retention-days`: CloudWatch log retention
- `autoscaling/min-capacity`: Minimum ECS task capacity
- `autoscaling/max-capacity`: Maximum ECS task capacity
- `performance/processing-timeout-ms`: Image processing timeout
- `features/enable-xray`: Enable AWS X-Ray tracing
- `features/enable-waf`: Enable AWS WAF protection

### Secrets Manager Secrets
Located at `/ai-photobooth/{environment}/`:

- `github-token`: GitHub personal access token
- `database-credentials`: Database connection credentials
- `external-api-keys`: API keys for external services

## Deployment Hooks

The pipeline includes four deployment hooks for comprehensive validation:

### 1. Pre-traffic Hook (`pre-traffic-hook.sh`)
- Validates new tasks are running and healthy
- Checks container health status
- Tests basic application connectivity
- **Timeout**: 5 minutes

### 2. Application Start Hook (`application-start-hook.sh`)
- Validates application startup
- Checks database connectivity
- Validates S3 bucket access
- Tests external service connectivity
- **Timeout**: 5 minutes

### 3. Application Stop Hook (`application-stop-hook.sh`)
- Drains connections from old tasks
- Backs up current application state
- Validates new deployment health
- Performs cleanup tasks
- **Timeout**: 5 minutes

### 4. Validate Service Hook (`validate-service-hook.sh`)
- Comprehensive service health validation
- Target group health checks
- Application endpoint testing
- Performance metrics validation
- Basic load testing
- **Timeout**: 10 minutes

## Monitoring and Observability

### CloudWatch Metrics
Custom metrics tracked during deployment:

- `AI-Photobooth/Deployment/PreTrafficHookExecuted`
- `AI-Photobooth/Deployment/ApplicationStartHookExecuted`
- `AI-Photobooth/Deployment/ApplicationStopHookExecuted`
- `AI-Photobooth/Deployment/ValidateServiceHookExecuted`
- `AI-Photobooth/Deployment/DeploymentValidationResult`

### X-Ray Tracing
When enabled, provides distributed tracing for:
- Deployment pipeline execution
- Lambda function invocations
- Application request flows

### EventBridge Integration
Captures and processes:
- Pipeline state changes
- Deployment state changes
- Custom deployment events

## Load Testing

### Artillery.js Configuration
Located at `packages/backend/tests/load/basic-load-test.yml`:

- **Phases**: Warm-up, ramp-up, sustained load, peak load, cool-down
- **Scenarios**: Health checks, themes API, upload URLs, processing status
- **Thresholds**: 95th percentile < 2s, 99th percentile < 5s, error rate < 1%

### Test Scenarios
1. **Health Check** (40% weight): Tests `/api/health` endpoint
2. **Get Themes** (30% weight): Tests `/api/themes` endpoint
3. **Generate Upload URL** (20% weight): Tests `/api/upload/presigned` endpoint
4. **Check Processing Status** (10% weight): Tests `/api/process/{id}` endpoint

## Deployment Process

### Manual Deployment
```bash
# Deploy the CI/CD pipeline infrastructure
npm run deploy:cicd

# The pipeline will automatically trigger on code changes
```

### Environment-specific Deployment
```bash
# Deploy to specific environment
cdk deploy PhotoboothCicd-staging --context environment=staging
```

### Validation Script
```bash
# Run deployment validation manually
npm run validate-deployment
```

## Security Considerations

### IAM Roles and Policies
- **Pipeline Role**: Minimal permissions for pipeline orchestration
- **Build Roles**: ECR push/pull, S3 access, Parameter Store read
- **Deploy Role**: ECS service updates, CodeDeploy operations
- **Lambda Role**: ECS/ELB describe, CloudWatch metrics, Parameter Store read

### Secrets Management
- GitHub tokens stored in Secrets Manager
- Database credentials auto-generated and rotated
- API keys encrypted at rest and in transit

### Network Security
- Private subnets for ECS tasks
- Security groups with minimal required access
- VPC endpoints for AWS service communication

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check CodeBuild logs in CloudWatch
   - Verify ECR repository permissions
   - Ensure Docker daemon is running in build environment

2. **Deployment Failures**
   - Check CodeDeploy deployment logs
   - Verify ECS service health
   - Check target group health status

3. **Validation Failures**
   - Review Lambda function logs
   - Check application health endpoints
   - Verify CloudWatch metrics

### Debugging Commands
```bash
# Check pipeline status
aws codepipeline get-pipeline-state --name ai-photobooth-pipeline-dev

# Check deployment status
aws codedeploy get-deployment --deployment-id <deployment-id>

# Check ECS service status
aws ecs describe-services --cluster photobooth-cluster-dev --services photobooth-processing-dev

# Check target group health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

## Rollback Procedures

### Automatic Rollback
- Triggered by CloudWatch alarms
- Activated on deployment validation failures
- Reverts to previous stable version

### Manual Rollback
```bash
# Stop current deployment
aws codedeploy stop-deployment --deployment-id <deployment-id> --auto-rollback-enabled

# Rollback via CodeDeploy
aws codedeploy create-deployment \
  --application-name ai-photobooth-dev \
  --deployment-group-name ai-photobooth-dg-dev \
  --revision revisionType=S3,s3Location=bucket=<bucket>,key=<previous-version>
```

## Performance Optimization

### Build Optimization
- Docker layer caching
- Parallel build execution
- Artifact compression

### Deployment Optimization
- Blue-green deployment for zero downtime
- Health check optimization
- Connection draining

### Monitoring Optimization
- Custom CloudWatch dashboards
- Automated alerting
- Performance baseline tracking

## Maintenance

### Regular Tasks
- Review and rotate secrets monthly
- Update base Docker images quarterly
- Review and optimize build times
- Update deployment validation thresholds

### Monitoring
- Pipeline execution metrics
- Build duration trends
- Deployment success rates
- Validation failure analysis

## Cost Optimization

### Resource Management
- Auto-scaling based on demand
- Lifecycle policies for artifacts
- Spot instances for non-critical builds
- Reserved capacity for predictable workloads

### Monitoring Costs
- CloudWatch usage optimization
- ECR repository cleanup
- S3 storage lifecycle management
- Lambda execution optimization