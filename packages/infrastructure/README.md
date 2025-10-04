# AI Photobooth Infrastructure

AWS CDK infrastructure as code for scalable, secure, and monitored deployment.

## Architecture

- **Compute**: ECS Fargate with auto-scaling and load balancing
- **Storage**: S3 with CloudFront CDN and lifecycle policies
- **Database**: DynamoDB with on-demand scaling
- **AI/ML**: AWS Rekognition for face detection and analysis
- **Monitoring**: CloudWatch with custom metrics and alarms
- **Security**: VPC, security groups, and IAM roles with least privilege

## Stacks

### PhotoboothStack
Main application infrastructure including:
- ECS cluster with Fargate services
- Application Load Balancer with SSL termination
- S3 bucket with CloudFront distribution
- DynamoDB tables for jobs and themes
- CloudWatch dashboards and alarms

### EcrStack
Container registry for Docker images:
- ECR repositories for frontend and backend
- Lifecycle policies for image cleanup
- Cross-account access policies

### Monitoring
Comprehensive observability:
- Custom CloudWatch metrics
- SNS topics for alerting
- Performance budget monitoring
- Error rate and success rate tracking

## Deployment

```bash
# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy ECR repositories
cdk deploy EcrStack-dev

# Deploy main infrastructure
cdk deploy PhotoboothStack-dev

# Deploy with specific context
cdk deploy --context environment=prod

# Destroy infrastructure
cdk destroy
```

## Environment Configuration

### Development
```bash
cdk deploy --context environment=dev
```
- Single AZ deployment
- Minimal instance sizes
- Development-friendly settings

### Production
```bash
cdk deploy --context environment=prod
```
- Multi-AZ deployment
- Production instance sizes
- Enhanced monitoring and alerting

## Monitoring & Alerting

### CloudWatch Metrics
- Processing time and success rate
- Memory and CPU utilization
- Request count and error rate
- Performance budget violations

### Alarms
- Processing time > 10 seconds
- Error rate > 5%
- Memory usage > 80%
- Failed job count threshold

### Dashboards
- Real-time performance metrics
- System health overview
- Cost and usage tracking
- User activity patterns

## Security

### Network Security
- VPC with private subnets
- Security groups with minimal access
- NAT Gateway for outbound traffic
- VPC endpoints for AWS services

### Access Control
- IAM roles with least privilege
- Service-to-service authentication
- Encrypted data at rest and in transit
- Secure secrets management

### Compliance
- GDPR-compliant data handling
- Automatic data lifecycle management
- Audit logging and monitoring
- Privacy-focused architecture

## Cost Optimization

### Resource Optimization
- On-demand DynamoDB scaling
- S3 lifecycle policies
- ECS auto-scaling policies
- CloudFront caching strategies

### Monitoring
- Cost allocation tags
- Budget alerts and limits
- Resource utilization tracking
- Rightsizing recommendations

## Scaling

### Horizontal Scaling
- ECS service auto-scaling
- Application Load Balancer
- DynamoDB on-demand capacity
- CloudFront global distribution

### Performance
- CDN edge caching
- Database query optimization
- Image processing optimization
- Background job processing

## Disaster Recovery

### Backup Strategy
- S3 cross-region replication
- DynamoDB point-in-time recovery
- Infrastructure as code versioning
- Automated backup verification

### Recovery Procedures
- Multi-AZ deployment
- Automated failover
- Infrastructure recreation
- Data restoration processes