import { Request, Response, NextFunction } from 'express';
import { performanceMonitoringService } from '../services/performanceMonitoring.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface PerformanceRequest extends Request {
  performanceId?: string;
  startTime?: number;
}

/**
 * Middleware to track request performance
 */
export function performanceTracking(req: PerformanceRequest, res: Response, next: NextFunction): void {
  const performanceId = uuidv4();
  const startTime = Date.now();
  
  req.performanceId = performanceId;
  req.startTime = startTime;

  // Determine operation type based on route
  const operationType = getOperationType(req.path, req.method);
  
  // Start tracking the operation
  performanceMonitoringService.startOperation(performanceId, operationType);
  
  logger.debug('Performance tracking started', {
    performanceId,
    operationType,
    method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
    path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
    timestamp: new Date().toISOString()
  });

  // Track response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = performanceMonitoringService.endOperation(performanceId, res.statusCode < 400);
    
    // Log performance metrics
    logger.info('Request completed', {
      method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
      path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
      statusCode: res.statusCode,
      duration,
      operationType,
      performanceId,
    });

    // Add performance headers
    res.set({
      'X-Response-Time': `${duration}ms`,
      'X-Performance-ID': performanceId,
    });

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Middleware to check system load and potentially throttle requests
 */
export function loadBalancing(req: Request, res: Response, next: NextFunction): void {
  const isHighLoad = performanceMonitoringService.isSystemUnderHighLoad();
  
  if (isHighLoad) {
    // For non-critical endpoints, return 503 Service Unavailable
    if (isNonCriticalEndpoint(req.path)) {
      logger.warn('Rejecting non-critical request due to high system load', {
        path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
        method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
      });
      
      res.status(503).json({
        error: 'Service temporarily unavailable due to high load',
        retryAfter: 30,
      });
    }
    
    // For critical endpoints, add warning header but continue
    res.set('X-System-Load', 'high');
    logger.warn('Processing request under high system load', {
      path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
      method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
    });
  }

  next();
}

/**
 * Middleware to add performance monitoring headers
 */
export function performanceHeaders(req: Request, res: Response, next: NextFunction): void {
  const stats = performanceMonitoringService.getPerformanceStats();
  
  res.set({
    'X-Active-Operations': stats.activeOperations.toString(),
    'X-Memory-Usage': `${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`,
    'X-Avg-Processing-Time': `${Math.round(stats.averageProcessingTime)}ms`,
  });

  next();
}

/**
 * Middleware to provide performance statistics endpoint
 */
export function performanceStats(req: Request, res: Response): void {
  try {
    const stats = performanceMonitoringService.getPerformanceStats();
    const recommendations = performanceMonitoringService.getOptimizationRecommendations();
    
    res.json({
      performance: {
        activeOperations: stats.activeOperations,
        averageProcessingTime: Math.round(stats.averageProcessingTime),
        recentSuccessRate: Math.round(stats.recentSuccessRate * 100),
        memoryUsage: {
          heapUsed: Math.round(stats.memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(stats.memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(stats.memoryUsage.rss / 1024 / 1024),
          external: Math.round(stats.memoryUsage.external / 1024 / 1024),
        },
        connectionPools: stats.connectionPools,
        isUnderHighLoad: performanceMonitoringService.isSystemUnderHighLoad(),
        recommendations,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const sanitizedError = error instanceof Error ? 
      error.message.replace(/[\r\n\t<>"'&]/g, '') : 'Unknown error';
    
    logger.error('Failed to get performance stats', { error: sanitizedError });
    res.status(500).json({
      error: 'Failed to retrieve performance statistics',
    });
  }
}

/**
 * Get operation type based on request path and method
 */
function getOperationType(path: string, method: string): string {
  if (path.startsWith('/api/upload')) {
    return 'Upload';
  } else if (path.startsWith('/api/process')) {
    return method === 'POST' ? 'ProcessingStart' : 'ProcessingStatus';
  } else if (path.startsWith('/api/themes')) {
    return 'ThemeRetrieval';
  } else if (path.startsWith('/api/health')) {
    return 'HealthCheck';
  } else if (path.startsWith('/api/performance')) {
    return 'PerformanceStats';
  }
  
  return 'Unknown';
}

/**
 * Check if an endpoint is non-critical and can be throttled under high load
 */
function isNonCriticalEndpoint(path: string): boolean {
  const nonCriticalPaths = [
    '/api/performance',
    '/api/themes', // Can be cached
  ];
  
  return nonCriticalPaths.some(nonCriticalPath => path.startsWith(nonCriticalPath));
}

/**
 * Express error handler for performance-related errors
 */
export function performanceErrorHandler(
  error: Error,
  req: PerformanceRequest,
  res: Response,
  next: NextFunction
): void {
  // End performance tracking for failed requests
  if (req.performanceId) {
    performanceMonitoringService.endOperation(req.performanceId, false);
  }

  // Check if error is performance-related
  if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
    logger.error('Performance-related error', {
      error: error.message?.replace(/[\r\n\t]/g, '') || 'Unknown error',
      path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
      method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
      performanceId: req.performanceId,
    });
    
    res.status(503).json({
      error: 'Service temporarily unavailable due to performance issues',
      retryAfter: 60,
    });
  }

  next(error);
}