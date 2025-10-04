import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

/**
 * Sanitize query parameters for logging
 */
function sanitizeQueryForLogging(query: any): any {
  if (!query || typeof query !== 'object') {
    return query;
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(query)) {
    const sanitizedKey = key.replace(/[\r\n\t]/g, '');
    const sanitizedValue = typeof value === 'string' ? value.replace(/[\r\n\t]/g, '') : value;
    sanitized[sanitizedKey] = sanitizedValue;
  }
  
  return sanitized;
}

/**
 * Middleware to add request ID and log requests
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  const requestId = uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
    path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
    query: sanitizeQueryForLogging(req.query),
    ip: (req.ip || 'unknown').replace(/[\r\n\t]/g, ''),
    userAgent: req.get('User-Agent')?.replace(/[\r\n\t]/g, '') || 'unknown',
    contentLength: req.get('Content-Length')?.replace(/[\r\n\t]/g, '') || 'unknown',
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      requestId,
      method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
      path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length')?.replace(/[\r\n\t]/g, '') || 'unknown',
    });

    return originalEnd(chunk, encoding, cb);
  } as any;

  next();
};