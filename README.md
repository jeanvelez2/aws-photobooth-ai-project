# AI Photobooth

A web-based application that allows users to take photos and have their faces intelligently integrated into themed backgrounds using AI-powered face processing.

## 🚀 Features

- **Real-time Camera Capture**: WebRTC-based camera integration with front/rear switching
- **AI Face Detection**: AWS Rekognition-powered face detection with 95%+ confidence
- **Theme Integration**: Multiple themed backgrounds (Barbarian, Greek, Mystic, Anime)
- **Advanced Processing**: OpenCV-based face alignment, scaling, and seamless blending
- **Cloud Infrastructure**: Scalable AWS architecture with ECS Fargate and CloudFront
- **Real-time Status**: Live processing updates with progress indicators
- **Mobile Responsive**: Optimized for both desktop and mobile devices
- **Privacy Focused**: Automatic image cleanup and GDPR compliance

## 🏗️ Project Structure

This is a monorepo containing:

- `packages/frontend` - React frontend application with Vite
- `packages/backend` - Node.js Express API server
- `packages/shared` - Shared TypeScript types and utilities
- `packages/infrastructure` - AWS CDK infrastructure as code

## 📋 Prerequisites

- **Node.js** 18+ (Node.js 22+ recommended)
- **npm** 9+
- **Docker** and Docker Compose (for local development)
- **AWS CLI** (for infrastructure deployment)
- **AWS Account** with appropriate permissions for S3, Rekognition, DynamoDB, ECS

## 🚀 Getting Started

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-photobooth
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   # Edit .env with your AWS credentials and configuration
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend on http://localhost:3000
   - Backend on http://localhost:3001

### Docker Development

1. **Build and start services**
   ```bash
   docker-compose up --build
   ```

2. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## 📜 Available Scripts

### Root Level Commands
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build all packages
- `npm run test` - Run tests for all packages
- `npm run lint` - Lint all packages with ESLint
- `npm run lint:fix` - Fix linting issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run clean` - Clean all build artifacts and node_modules

### Package-Specific Commands
- `npm run dev:frontend` - Start only frontend development server
- `npm run dev:backend` - Start only backend development server
- `npm run build:frontend` - Build only frontend for production
- `npm run build:backend` - Build only backend for production

## 🏛️ Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript 5.7 + Tailwind CSS 3.4 + Vite 6
- **Backend**: Node.js + Express 4.21 + TypeScript 5.7
- **Infrastructure**: AWS CDK 2.175 (S3, Rekognition, DynamoDB, ECS Fargate, CloudFront)
- **Image Processing**: Sharp 0.34 + OpenCV integration
- **Testing**: Vitest 3.2 + Testing Library 16 + Playwright
- **State Management**: TanStack Query v5 + React Context
- **Styling**: Tailwind CSS with responsive design

### AWS Services Used
- **S3**: Image storage with lifecycle policies
- **Rekognition**: AI-powered face detection and analysis
- **DynamoDB**: Processing job management and theme storage
- **ECS Fargate**: Containerized backend with GPU support
- **CloudFront**: Global CDN for static content delivery
- **Application Load Balancer**: Traffic distribution and SSL termination
- **CloudWatch**: Monitoring, logging, and alerting
- **X-Ray**: Distributed tracing and performance monitoring

### Processing Pipeline
1. **Capture**: WebRTC camera integration captures high-resolution photos
2. **Upload**: Secure pre-signed URL upload to S3
3. **Detection**: AWS Rekognition analyzes facial features and landmarks
4. **Processing**: OpenCV-based face alignment, scaling, and theme integration
5. **Delivery**: Processed images served via CloudFront CDN

## 🛠️ Development Guidelines

- **TypeScript**: Strict mode enabled across all packages
- **Code Quality**: ESLint and Prettier for consistent formatting
- **Testing**: Comprehensive unit, integration, and E2E tests
- **Architecture**: Follow established patterns and use shared types
- **Security**: Input validation, rate limiting, and secure headers
- **Performance**: Optimized for <8 second processing time target

## 🔧 Environment Configuration

### Required Environment Variables
See `packages/backend/.env.example` for complete configuration:

```bash
# AWS Configuration
AWS_REGION=us-east-1
# Note: In production, AWS credentials are handled automatically via IAM roles
# For local development, use: aws configure or set AWS_PROFILE=your-profile

# S3 Configuration
S3_BUCKET_NAME=your-photobooth-bucket
S3_REGION=us-east-1

# DynamoDB Configuration
DYNAMODB_PROCESSING_JOBS_TABLE=processing-jobs
DYNAMODB_THEMES_TABLE=themes

# Application Configuration
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

## 🚀 Deployment

### Prerequisites for Deployment

Before deploying, ensure you have:

1. **AWS CLI configured** with appropriate permissions
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region
   ```

2. **Required AWS permissions** for your IAM user/role:
   - S3 (CreateBucket, PutObject, GetObject, DeleteObject)
   - Rekognition (DetectFaces, DetectLabels)
   - DynamoDB (CreateTable, PutItem, GetItem, UpdateItem, DeleteItem)
   - ECS (CreateCluster, CreateService, RegisterTaskDefinition)
   - CloudFront (CreateDistribution, UpdateDistribution)
   - IAM (CreateRole, AttachRolePolicy)
   - CloudWatch (PutMetricData, CreateLogGroup)

3. **Docker installed** (for containerized deployments)

### Step-by-Step Deployment Guide

#### 1. Deploy AWS Infrastructure

The infrastructure package uses AWS CDK to provision all required AWS resources:

```bash
# Navigate to infrastructure package
cd packages/infrastructure

# Install CDK dependencies
npm install

# Bootstrap CDK (first time only)
npx cdk bootstrap

# Deploy infrastructure stack
npx cdk deploy

# Or use the npm script
npm run deploy
```

This will create:
- S3 bucket for image storage
- DynamoDB tables for jobs and themes
- ECS Fargate cluster with GPU support
- Application Load Balancer
- CloudFront distribution
- IAM roles and security groups

#### 2. Build Applications for Production

```bash
# From project root, build all packages
npm run build

# Or build individually
npm run build:frontend  # Creates optimized React build
npm run build:backend   # Compiles TypeScript to JavaScript
```

#### 3. Deploy Backend to ECS

The backend is containerized and deployed to ECS Fargate:

```bash
# Build and push Docker image
docker build -f Dockerfile.backend -t ai-photobooth-backend .
docker tag ai-photobooth-backend:latest <your-ecr-repo>:latest
docker push <your-ecr-repo>:latest

# Update ECS service (handled by CDK deployment)
```

#### 4. Deploy Frontend to S3/CloudFront

```bash
# Upload frontend build to S3
aws s3 sync packages/frontend/dist s3://your-photobooth-bucket/

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id <your-distribution-id> --paths "/*"
```

### Environment-Specific Deployments

#### Development Environment
```bash
# Deploy with development configuration
npx cdk deploy --context environment=development
```

#### Production Environment
```bash
# Deploy with production configuration
npx cdk deploy --context environment=production
```

### CI/CD Pipeline Deployment

The project includes AWS CodePipeline for automated deployments:

1. **Source Stage**: Triggered by GitHub commits
2. **Build Stage**: CodeBuild compiles and tests the application
3. **Deploy Stage**: CodeDeploy handles blue-green deployment to ECS

To set up the pipeline:

```bash
cd packages/infrastructure
npx cdk deploy PhotoboothPipelineStack
```

### Post-Deployment Configuration

#### 1. Seed Theme Data
```bash
# Run theme seeding script
npm run seed:themes
```

#### 2. Configure Domain (Optional)
```bash
# Update Route 53 DNS records to point to CloudFront
aws route53 change-resource-record-sets --hosted-zone-id <zone-id> --change-batch file://dns-changes.json
```

#### 3. Set up Monitoring
```bash
# Deploy monitoring stack
npx cdk deploy PhotoboothMonitoringStack
```

### Deployment Verification

After deployment, verify everything is working:

1. **Health Check**: Visit `https://your-domain.com/api/health`
2. **Frontend**: Access the main application
3. **Processing**: Test the complete photo processing workflow
4. **Monitoring**: Check CloudWatch dashboards

### Rollback Procedures

If issues occur after deployment:

```bash
# Rollback ECS service to previous task definition
aws ecs update-service --cluster photobooth-cluster --service photobooth-service --task-definition <previous-task-def>

# Rollback CloudFront to previous S3 version
aws s3 sync s3://your-backup-bucket/ s3://your-photobooth-bucket/
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"
```

### Cost Optimization

To minimize AWS costs:

- **S3 Lifecycle Policies**: Automatically delete processed images after 24 hours
- **ECS Auto Scaling**: Scale down during low usage periods
- **CloudFront Caching**: Optimize cache settings to reduce origin requests
- **Reserved Instances**: Use reserved capacity for predictable workloads

### Troubleshooting Common Deployment Issues

1. **CDK Bootstrap Issues**:
   ```bash
   npx cdk bootstrap --force
   ```

2. **Permission Errors**:
   - Verify IAM permissions
   - Check AWS CLI configuration

3. **ECS Task Failures**:
   - Check CloudWatch logs
   - Verify environment variables
   - Ensure Docker image is accessible

4. **Frontend Not Loading**:
   - Verify S3 bucket permissions
   - Check CloudFront distribution status
   - Confirm DNS settings

## 📊 Monitoring & Observability

- **CloudWatch Metrics**: Processing time, success rates, error rates
- **X-Ray Tracing**: End-to-end request tracing
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Health Checks**: Automated service health monitoring
- **Performance Budgets**: Bundle size and performance monitoring

## 🔒 Security Features

- **Rate Limiting**: 10 requests per minute per IP
- **Input Validation**: Comprehensive request validation and sanitization
- **Security Headers**: CSP, HSTS, and other security headers
- **HTTPS Enforcement**: SSL/TLS encryption for all communications
- **Data Privacy**: GDPR-compliant data handling and automatic cleanup

## 🧪 Testing

### Test Types
- **Unit Tests**: Component and service-level testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Complete user workflow testing with Playwright
- **Load Tests**: Performance testing with Artillery.js
- **Visual Regression**: UI consistency testing

### Running Tests
```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

## 📈 Performance

- **Target Processing Time**: <8 seconds end-to-end
- **Auto-scaling**: ECS Fargate with CPU/memory-based scaling
- **CDN Caching**: CloudFront for global content delivery
- **Image Optimization**: Automatic compression and format optimization
- **Bundle Optimization**: Code splitting and lazy loading

## 🔄 Latest Updates

### December 2024 - Major Dependency Upgrades & Feature Complete

**All 23 implementation tasks completed:**
- ✅ Complete camera capture and theme selection system
- ✅ AWS infrastructure with CDK (S3, Rekognition, DynamoDB, ECS)
- ✅ Advanced image processing pipeline with OpenCV
- ✅ Real-time processing status and job management
- ✅ Comprehensive error handling and user feedback
- ✅ Security, monitoring, and performance optimization
- ✅ Full CI/CD pipeline with AWS CodePipeline
- ✅ Privacy compliance and data lifecycle management

**Technology Stack Updates:**
- React Query → TanStack Query v5.90.2
- Vite 4 → Vite 6.0.7
- TypeScript 5.0 → TypeScript 5.7.2
- AWS SDK v3.423 → v3.716.0
- AWS CDK 2.100 → 2.175.0
- All dependencies updated to latest stable versions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

Private - All rights reserved