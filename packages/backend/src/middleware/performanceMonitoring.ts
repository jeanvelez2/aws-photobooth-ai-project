import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService.js';
import { logger } from '../utils/logger.js';

interface PerformanceBudgets {
  responseTime: number; // ms
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
}

const PERFORMANCE_BUDGETS: PerformanceBudgets = {
  responseTime: 5000, // 5s max response time
  memoryUsage: 512, // 512MB max memory
  cpuUsage: 80 // 80% max CPU
};

export function performanceMonitoring(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryUsed = Math.round(endMemory.heapUsed / 1024 / 1024); // MB

    // Check response time budget
    if (responseTime > PERFORMANCE_BUDGETS.responseTime) {
      logger.warn('Response time budget exceeded', {
        endpoint: req.path,
        responseTime,
        budget: PERFORMANCE_BUDGETS.responseTime
      });
      
      await metricsService.recordMetric('BudgetViolation', 1, 'Count', [
        { Name: 'Type', Value: 'ResponseTime' },
        { Name: 'Endpoint', Value: req.path }
      ]);
    }

    // Check memory budget
    if (memoryUsed > PERFORMANCE_BUDGETS.memoryUsage) {
      logger.warn('Memory usage budget exceeded', {
        memoryUsed,
        budget: PERFORMANCE_BUDGETS.memoryUsage
      });
      
      await metricsService.recordMetric('BudgetViolation', 1, 'Count', [
        { Name: 'Type', Value: 'Memory' }
      ]);
    }

    // Record performance metrics
    await metricsService.recordMetric('ResponseTime', responseTime, 'Milliseconds', [
      { Name: 'Endpoint', Value: req.path },
      { Name: 'Method', Value: req.method }
    ]);

    await metricsService.recordMetric('MemoryUsage', memoryUsed, 'Megabytes');
  });

  next();
}

export function checkSystemPerformance(): void {
  setInterval(async () => {
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    
    // Get CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    
    if (memoryUsedMB > PERFORMANCE_BUDGETS.memoryUsage) {
      logger.warn('System memory budget exceeded', { memoryUsedMB });
    }
    
    await metricsService.recordMetric('SystemMemory', memoryUsedMB, 'Megabytes');
    await metricsService.recordMetric('SystemCPU', cpuPercent, 'Percent');
    
  }, 60000); // Check every minute
}