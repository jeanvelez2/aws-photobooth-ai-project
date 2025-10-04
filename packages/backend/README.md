# AI Photobooth Backend

Node.js Express API server with AWS integration for AI-powered face processing and theme management.

## Features

- **Face Detection**: AWS Rekognition with gender and age analysis
- **Image Processing**: Sharp-based processing with face blending and optimization
- **Job Queue**: Background processing with retry logic and cleanup
- **Theme Management**: Dynamic theme selection with gender-adaptive variants
- **Security**: Advanced rate limiting, input validation, and SSRF protection
- **Monitoring**: CloudWatch metrics, performance budgets, and health checks
- **Scalability**: ECS Fargate deployment with auto-scaling

## Technology Stack

- **Node.js 22** with TypeScript 5.7
- **Express 5.1** with comprehensive middleware
- **AWS SDK v3** for cloud services integration
- **Sharp 0.34** for high-performance image processing
- **DynamoDB** for job and theme storage
- **S3** for image storage with lifecycle policies

## API Endpoints

```
GET    /api/health              # Health check
GET    /api/themes              # List all themes
GET    /api/themes/:id          # Get specific theme
POST   /api/upload/presigned-url # Generate upload URL
POST   /api/process             # Create processing job
GET    /api/process/:id         # Get job status
GET    /api/gender/analyze      # Analyze gender from image
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
npm run test:integration
npm run test:load

# Theme management
npm run setup:themes
npm run seed:themes

# Job management
npm run worker:start
npm run jobs:cleanup
```

## Performance Budgets

- Response time: 5 seconds maximum
- Memory usage: 512MB maximum
- Processing time: 8 seconds target
- Success rate: 95% minimum

## AWS Services

- **S3**: Image storage with CORS and lifecycle policies
- **Rekognition**: Face detection and analysis
- **DynamoDB**: Job queue and theme storage
- **CloudWatch**: Metrics, logs, and alarms
- **ECS Fargate**: Containerized deployment

## Security Features

- Rate limiting (5 processing requests per 15 minutes)
- IP reputation tracking and blocking
- Input validation and sanitization
- SSRF protection with URL validation
- Security headers and CORS configuration
- Request size limiting (10MB maximum)

## Environment Variables

```bash
NODE_ENV=development
PORT=3001
AWS_REGION=us-east-1
S3_BUCKET=ai-photobooth-dev
THEMES_TABLE=photobooth-themes-dev
JOBS_TABLE=photobooth-processing-jobs-dev
CORS_ORIGIN=http://localhost:5173
```

## Monitoring

- Custom CloudWatch metrics for processing time and success rate
- Performance budget monitoring with violation alerts
- System resource monitoring (CPU, memory)
- Request/response time tracking per endpoint
- Error rate monitoring with automatic alerting

## Job Processing

- Background worker with cron scheduling
- Automatic retry with exponential backoff
- Job cleanup after 24 hours
- Gender-adaptive theme selection
- Image optimization and compression