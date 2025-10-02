import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '../services/monitoring.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to automatically track API metrics
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to capture metrics
  res.end = function(chunk?: any, encoding?: any): any {
    const responseTime = Date.now() - startTime;
    const endpoint = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode;

    // Record API metrics asynchronously
    setImmediate(async () => {
      try {
        await monitoringService.recordApiMetrics(endpoint, method, statusCode, responseTime);
        
        logger.info('API request completed', {
          endpoint,
          method,
          statusCode,
          responseTime,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        });
      } catch (error) {
        logger.error('Failed to record API metrics', {
          error: error instanceof Error ? error.message : 'Unknown error',
          endpoint,
          method,
          statusCode,
          responseTime,
        });
      }
    });

    // Call original end function
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Middleware to track system health metrics periodically
 */
export const healthMetricsMiddleware = () => {
  const interval = setInterval(async () => {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
      
      await monitoringService.recordHealthMetrics(memoryUsageMB);
      
      logger.debug('System health metrics recorded', {
        memoryUsageMB: Math.round(memoryUsageMB * 100) / 100,
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
      });
    } catch (error) {
      logger.error('Failed to record health metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, 60000); // Record every minute

  // Return cleanup function
  return () => clearInterval(interval);
};