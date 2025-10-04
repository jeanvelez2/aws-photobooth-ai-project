import { Router, Request, Response } from 'express';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { RekognitionClient, DescribeProjectsCommand } from '@aws-sdk/client-rekognition';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const router = Router();

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  error?: string;
  details?: any;
}

interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu?: {
      usage: number;
    };
  };
}

/**
 * Basic health check endpoint for load balancer
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Detailed health check endpoint
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: HealthCheckResult[] = [];

  try {
    // Check S3 connectivity
    const s3Check = await checkS3Health();
    checks.push(s3Check);

    // Check DynamoDB connectivity
    const dynamoCheck = await checkDynamoDBHealth();
    checks.push(dynamoCheck);

    // Check Rekognition service
    const rekognitionCheck = await checkRekognitionHealth();
    checks.push(rekognitionCheck);

    // Check memory usage
    const memoryCheck = checkMemoryHealth();
    checks.push(memoryCheck);

    // Determine overall status
    const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
    const hasDegraded = checks.some(check => check.status === 'degraded');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }

    const memoryUsage = process.memoryUsage();
    const systemHealth: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      system: {
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        },
      },
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    logger.info('Health check completed', {
      status: overallStatus,
      responseTime: Date.now() - startTime,
      checks: checks.map(c => ({ service: c.service, status: c.status })),
    });

    res.status(statusCode).json(systemHealth);
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

/**
 * Readiness probe endpoint for Kubernetes/ECS
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check critical dependencies
    const s3Check = await checkS3Health();
    const dynamoCheck = await checkDynamoDBHealth();

    const isReady = s3Check.status !== 'unhealthy' && dynamoCheck.status !== 'unhealthy';

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        issues: [
          ...(s3Check.status === 'unhealthy' ? ['S3 connectivity'] : []),
          ...(dynamoCheck.status === 'unhealthy' ? ['DynamoDB connectivity'] : []),
        ],
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Readiness check failed',
    });
  }
});

/**
 * Liveness probe endpoint for Kubernetes/ECS
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Check S3 service health
 */
async function checkS3Health(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    const command = new HeadBucketCommand({ Bucket: config.aws.s3.bucketName });
    
    await s3Client.send(command);
    
    return {
      service: 'S3',
      status: 'healthy',
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      service: 'S3',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'S3 check failed',
    };
  }
}

/**
 * Check DynamoDB service health
 */
async function checkDynamoDBHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const command = new DescribeTableCommand({ 
      TableName: config.aws.dynamodb.processingJobsTable 
    });
    
    const result = await dynamoClient.send(command);
    const isActive = result.Table?.TableStatus === 'ACTIVE';
    
    return {
      service: 'DynamoDB',
      status: isActive ? 'healthy' : 'degraded',
      responseTime: Date.now() - startTime,
      details: {
        tableStatus: result.Table?.TableStatus,
        itemCount: result.Table?.ItemCount,
      },
    };
  } catch (error) {
    return {
      service: 'DynamoDB',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'DynamoDB check failed',
    };
  }
}

/**
 * Check Rekognition service health
 */
async function checkRekognitionHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION });
    const command = new DescribeProjectsCommand({ MaxResults: 1 });
    
    await rekognitionClient.send(command);
    
    return {
      service: 'Rekognition',
      status: 'healthy',
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    // Rekognition might not have projects, but if we can call the API, it's healthy
    const isAccessDenied = error instanceof Error && error.message.includes('AccessDenied');
    
    return {
      service: 'Rekognition',
      status: isAccessDenied ? 'healthy' : 'degraded',
      responseTime: Date.now() - startTime,
      error: isAccessDenied ? undefined : (error instanceof Error ? error.message : 'Rekognition check failed'),
    };
  }
}

/**
 * Check memory health
 */
function checkMemoryHealth(): HealthCheckResult {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
  const usagePercentage = (heapUsedMB / heapTotalMB) * 100;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (usagePercentage > 90) {
    status = 'unhealthy';
  } else if (usagePercentage > 80) {
    status = 'degraded';
  }

  return {
    service: 'Memory',
    status,
    responseTime: 0,
    details: {
      heapUsedMB: Math.round(heapUsedMB * 100) / 100,
      heapTotalMB: Math.round(heapTotalMB * 100) / 100,
      usagePercentage: Math.round(usagePercentage * 100) / 100,
    },
  };
}

export default router;