import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

import { ProcessingErrorType } from 'shared/types/errors.js';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  type?: ProcessingErrorType;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

/**
 * Custom error class for application errors
 */
export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public type?: ProcessingErrorType;
  public severity: 'low' | 'medium' | 'high' | 'critical';
  public context?: Record<string, any>;

  constructor(
    message: string, 
    statusCode: number = 500, 
    code?: string,
    type?: ProcessingErrorType,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.type = type;
    this.severity = severity;
    this.context = context;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Processing-specific error class
 */
export class ProcessingError extends CustomError {
  constructor(
    type: ProcessingErrorType,
    message: string,
    statusCode: number = 400,
    context?: Record<string, any>
  ) {
    const severityMap: Record<ProcessingErrorType, 'low' | 'medium' | 'high' | 'critical'> = {
      [ProcessingErrorType.NO_FACE_DETECTED]: 'medium',
      [ProcessingErrorType.MULTIPLE_FACES]: 'medium',
      [ProcessingErrorType.POOR_IMAGE_QUALITY]: 'medium',
      [ProcessingErrorType.FACE_TOO_SMALL]: 'medium',
      [ProcessingErrorType.EXTREME_POSE]: 'medium',
      [ProcessingErrorType.PROCESSING_TIMEOUT]: 'high',
      [ProcessingErrorType.THEME_NOT_FOUND]: 'medium',
      [ProcessingErrorType.INTERNAL_ERROR]: 'high',
      [ProcessingErrorType.NETWORK_ERROR]: 'high',
      [ProcessingErrorType.SERVICE_UNAVAILABLE]: 'critical',
      [ProcessingErrorType.RATE_LIMITED]: 'medium',
      [ProcessingErrorType.INVALID_IMAGE_FORMAT]: 'medium',
      [ProcessingErrorType.IMAGE_TOO_LARGE]: 'medium',
      [ProcessingErrorType.UPLOAD_FAILED]: 'high',
    };

    super(message, statusCode, type, type, severityMap[type], context);
  }
}

/**
 * Global error handling middleware with enhanced logging and monitoring
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  // Enhanced error logging
  const errorLog = {
    requestId,
    error: {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      code: err.code,
      type: err.type,
      severity: err.severity || 'medium',
      isOperational: err.isOperational,
      context: err.context,
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      body: sanitizeRequestBody(req.body),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    },
  };

  // Log based on severity
  if (err.severity === 'critical') {
    logger.error('Critical error occurred', errorLog);
  } else if (err.severity === 'high') {
    logger.error('High severity error', errorLog);
  } else {
    logger.warn('Application error', errorLog);
  }

  // Send to monitoring service (if configured)
  if (process.env.ERROR_MONITORING_ENDPOINT) {
    sendToMonitoring(errorLog).catch(console.error);
  }

  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Prepare error response
  const errorResponse: any = {
    error: true,
    message: getPublicErrorMessage(err),
    requestId,
    timestamp: new Date().toISOString(),
  };

  // Add error details for client-side error handling
  if (err.type) {
    errorResponse.type = err.type;
    errorResponse.severity = err.severity;
    errorResponse.retryable = isRetryableError(err);
  }

  // Add error code if available
  if (err.code) {
    errorResponse.code = err.code;
  }

  // Include additional details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.context = err.context;
  }

  // Set appropriate headers
  res.set({
    'X-Request-ID': requestId,
    'X-Error-Type': err.type || 'INTERNAL_ERROR',
  });

  res.status(statusCode).json(errorResponse);
};

/**
 * Get public-facing error message (hide sensitive details)
 */
function getPublicErrorMessage(err: AppError): string {
  // For operational errors, return the original message
  if (err.isOperational) {
    return err.message;
  }

  // For non-operational errors, return generic message
  switch (err.statusCode) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not found';
    case 429:
      return 'Too many requests';
    case 500:
    default:
      return 'Internal server error';
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(err: AppError): boolean {
  const retryableTypes = [
    ProcessingErrorType.PROCESSING_TIMEOUT,
    ProcessingErrorType.SERVICE_UNAVAILABLE,
    ProcessingErrorType.NETWORK_ERROR,
    ProcessingErrorType.UPLOAD_FAILED,
    ProcessingErrorType.INTERNAL_ERROR,
  ];

  return err.type ? retryableTypes.includes(err.type) : err.statusCode !== 400;
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Send error to external monitoring service
 */
async function sendToMonitoring(errorLog: any): Promise<void> {
  try {
    await fetch(process.env.ERROR_MONITORING_ENDPOINT!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ERROR_MONITORING_TOKEN}`,
      },
      body: JSON.stringify(errorLog),
    });
  } catch (error) {
    logger.error('Failed to send error to monitoring service', { error });
  }
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Async error wrapper to catch async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};