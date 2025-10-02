import { Request, Response, NextFunction } from 'express';
import { correlationContext, generateCorrelationId } from '../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      userId?: string;
    }
  }
}

/**
 * Middleware to add correlation ID to requests for distributed tracing
 */
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Get correlation ID from header or generate new one
  const correlationId = (req.headers['x-correlation-id'] as string) || 
                       (req.headers['x-request-id'] as string) || 
                       generateCorrelationId();

  // Extract user ID from headers if available (for user-specific tracing)
  const userId = req.headers['x-user-id'] as string;

  // Add to request object
  req.correlationId = correlationId;
  if (userId) {
    req.userId = userId;
  }

  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  // Run the rest of the request in correlation context
  correlationContext.run({ correlationId, userId }, () => {
    next();
  });
};

/**
 * Utility function to get current correlation ID
 */
export const getCurrentCorrelationId = (): string | undefined => {
  return correlationContext.getStore()?.correlationId;
};

/**
 * Utility function to get current user ID
 */
export const getCurrentUserId = (): string | undefined => {
  return correlationContext.getStore()?.userId;
};