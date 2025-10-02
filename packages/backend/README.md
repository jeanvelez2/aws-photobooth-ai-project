# AI Photobooth Backend

Node.js backend API for the AI Photobooth application, built with Express and TypeScript.

## Features

- **Express Server**: RESTful API with TypeScript configuration
- **Security**: Helmet for security headers, CORS configuration, rate limiting
- **AWS Integration**: S3, DynamoDB, and Rekognition client setup
- **Middleware**: Request logging, validation, error handling
- **Structured Logging**: Winston logger with request correlation IDs
- **Testing**: Comprehensive unit and integration tests

## API Endpoints

### Health Check
- `GET /api/health` - Server health status and metrics

### Themes
- `GET /api/themes` - List all available themes
- `GET /api/themes/:id` - Get specific theme by ID

## Architecture

### Middleware Stack
1. **Request Logger**: Adds unique request IDs and structured logging
2. **Security Headers**: Helmet for CSP, XSS protection, etc.
3. **CORS**: Cross-origin resource sharing configuration
4. **Rate Limiting**: 10 requests per minute per IP for API routes
5. **Body Parsing**: JSON and URL-encoded data parsing
6. **Error Handler**: Global error handling with structured responses

### AWS Services
- **S3**: Image storage and pre-signed URL generation
- **DynamoDB**: Processing jobs and theme data storage
- **Rekognition**: Face detection and analysis

### Error Handling
- Custom error classes with proper HTTP status codes
- Structured error responses with request correlation
- Async error wrapper for route handlers
- Development vs production error details

## Configuration

Environment variables are managed through the config system:

```typescript
{
  port: 3001,
  aws: {
    region: 'us-east-1',
    s3: { bucket: 'ai-photobooth-dev' },
    dynamodb: {
      processingJobsTable: 'processing-jobs-dev',
      themesTable: 'themes-dev'
    }
  },
  processing: {
    timeoutMs: 15000,
    maxRetries: 3
  },
  upload: {
    maxSizeMB: 10,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## Testing

The test suite includes:
- Unit tests for middleware and utilities
- Integration tests for API routes
- Server configuration tests
- Error handling validation
- Rate limiting verification

## Security Features

- **Rate Limiting**: 10 requests/minute per IP
- **CORS**: Configurable origin whitelist
- **Security Headers**: CSP, XSS protection, HSTS
- **Input Validation**: Request validation middleware
- **Error Sanitization**: Safe error responses in production

## Logging

Structured logging with Winston includes:
- Request correlation IDs
- Request/response timing
- Error tracking with stack traces
- Configurable log levels
- JSON format for production

## Next Steps

This foundation supports the following upcoming features:
- S3 pre-signed URL generation (Task 8)
- Image upload functionality (Task 9)
- Face detection service (Task 10)
- Image processing pipeline (Task 11)
- Processing job management (Task 12)