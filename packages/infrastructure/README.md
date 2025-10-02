# AI Photobooth Infrastructure

This package contains the AWS CDK infrastructure code for the AI Photobooth application.

## Architecture Overview

The infrastructure includes:

- **S3 Bucket**: For storing uploaded images, processed results, and static website content
- **DynamoDB Tables**: For processing jobs and theme management
- **ECS Fargate Cluster**: For running the image processing service with GPU support
- **Application Load Balancer**: For distributing traffic to ECS tasks
- **CloudFront Distribution**: For global content delivery and caching
- **VPC**: With public and private subnets across multiple AZs
- **Security Groups**: For network access control
- **IAM Roles**: With least-privilege permissions

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 18+ installed (Node.js 22+ recommended)
3. AWS CDK CLI installed globally: `npm install -g aws-cdk@latest`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Bootstrap CDK (first time only):
   ```bash
   npx cdk bootstrap
   ```

## Deployment

1. Build the TypeScript code:
   ```bash
   npm run build
   ```

2. Review the changes:
   ```bash
   npm run diff
   ```

3. Deploy the stack:
   ```bash
   npm run deploy
   ```

## Environment Variables

Set these environment variables before deployment:

- `CDK_DEFAULT_ACCOUNT`: Your AWS account ID
- `CDK_DEFAULT_REGION`: Target AWS region (default: us-east-1)
- `ENVIRONMENT`: Environment name (dev/staging/prod)

## Testing

Run the infrastructure tests:

```bash
npm test
```

## Cleanup

To destroy the stack and all resources:

```bash
npm run destroy
```

**Warning**: This will delete all data in S3 buckets and DynamoDB tables.

## Cost Optimization

The infrastructure is configured with cost optimization in mind:

- Single NAT Gateway instead of one per AZ
- CloudFront PriceClass 100 (North America and Europe only)
- DynamoDB Pay-per-request billing
- ECS auto-scaling with conservative scaling policies
- S3 lifecycle policies for automatic cleanup

## Security Features

- All S3 buckets have public access blocked
- Security groups follow least-privilege principles
- IAM roles have minimal required permissions
- CloudFront enforces HTTPS with modern Origin Access Control (OAC)
- VPC isolates resources in private subnets
- DynamoDB tables have point-in-time recovery enabled
- All resources use latest security best practices

## Monitoring

The infrastructure includes:

- CloudWatch log groups for ECS tasks
- Container insights for ECS cluster
- Health checks for load balancer targets
- Auto-scaling based on CPU and memory metrics

## Outputs

After deployment, the stack outputs:

- S3 bucket name
- DynamoDB table names
- Load balancer DNS name
- CloudFront distribution domain name
- ECS cluster name

These outputs can be used by the application code to connect to AWS resources.

## Latest Updates

This infrastructure uses the latest AWS CDK version (2.175.0+) with modern best practices:

- **Updated Dependencies**: All dependencies upgraded to latest stable versions
- **Modern CloudFront**: Uses Origin Access Control (OAC) instead of legacy Origin Access Identity (OAI)
- **Enhanced DynamoDB**: Uses `pointInTimeRecoverySpecification` for better backup configuration
- **Security Improvements**: Latest security patterns and configurations
- **TypeScript 5.7+**: Latest TypeScript features and improvements
- **Node.js 22 Support**: Compatible with the latest Node.js LTS versions

### Breaking Changes from Previous Versions

- CloudFront now uses OAC which provides better security and performance
- DynamoDB configuration uses the new specification format
- Some deprecated APIs have been replaced with modern equivalents