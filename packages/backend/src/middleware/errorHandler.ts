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
  
  // Enhanced error logging with log injection protection
  const sanitizedRequestId = requestId?.replace(/[\r\n\t]/g, '') || 'unknown';
  const sanitizedErrorMessage = err.message?.replace(/[\r\n\t]/g, '') || 'Unknown error';
  const sanitizedPath = req.path?.replace(/[\r\n\t]/g, '') || 'unknown';
  const sanitizedUserAgent = req.get('User-Agent')?.replace(/[\r\n\t]/g, '') || 'unknown';
  const sanitizedErrorCode = err.code?.replace(/[\r\n\t]/g, '') || undefined;
  const sanitizedStack = err.stack?.replace(/[\r\n\t]/g, ' ') || undefined;
  const sanitizedContext = sanitizeContext(err.context);
  
  const errorLog = {
    requestId: sanitizedRequestId,
    error: {
      message: sanitizedErrorMessage,
      stack: sanitizedStack,
      statusCode: err.statusCode,
      code: sanitizedErrorCode,
      type: err.type,
      severity: err.severity || 'medium',
      isOperational: err.isOperational,
      context: sanitizedContext,
    },
    request: {
      method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
      path: sanitizedPath,
      query: sanitizeQueryParams(req.query),
      body: sanitizeRequestBody(req.body),
      ip: req.ip,
      userAgent: sanitizedUserAgent,
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
    sendToMonitoring(errorLog).catch((monitoringError) => {
      const sanitizedMonitoringError = monitoringError instanceof Error ? 
        monitoringError.message.replace(/[\r\n\t]/g, '') : 'Unknown monitoring error';
      console.error('Monitoring service error:', sanitizedMonitoringError);
    });
  }

  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Prepare error response with XSS protection
  const escapeMap: { [key: string]: string } = {
    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'
  };
  const sanitizedMessage = getPublicErrorMessage(err).replace(/[<>"'&]/g, (match) => escapeMap[match] || match);
  
  const errorResponse: any = {
    error: true,
    message: sanitizedMessage,
    requestId: sanitizedRequestId,
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
    const sanitizedCode = err.code.replace(/[<>"'&]/g, (match) => escapeMap[match] || match);
    errorResponse.code = sanitizedCode;
  }

  // Include additional details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = sanitizedStack;
    errorResponse.context = sanitizedContext;
  }

  // Set appropriate headers
  res.set({
    'X-Request-ID': sanitizedRequestId,
    'X-Error-Type': err.type || 'INTERNAL_ERROR',
  });

  res.status(statusCode).json(errorResponse);
};

/**
 * Get public-facing error message (hide sensitive details)
 */
function getPublicErrorMessage(err: AppError): string {
  // For operational errors, return the sanitized message
  if (err.isOperational) {
    return err.message?.replace(/[\r\n\t]/g, '') || 'Unknown error';
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
 * Sanitize context data for logging (remove newlines)
 */
function sanitizeContext(context: any): any {
  if (!context || typeof context !== 'object') {
    return context;
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(context)) {
    const sanitizedKey = key.replace(/[\r\n\t]/g, '');
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = value.replace(/[\r\n\t]/g, '');
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = sanitizeContext(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize query parameters for logging (remove newlines)
 */
function sanitizeQueryParams(query: any): any {
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
    const endpoint = process.env.ERROR_MONITORING_ENDPOINT;
    
    // Validate endpoint URL to prevent SSRF
    if (!endpoint || !endpoint.startsWith('https://')) {
      throw new Error('Invalid monitoring endpoint');
    }
    
    // Only allow specific trusted domains
    const allowedDomains = ['monitoring.example.com', 'logs.company.com'];
    const url = new URL(endpoint);
    if (!allowedDomains.includes(url.hostname)) {
      throw new Error('Monitoring endpoint not in allowlist');
    }
    
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ERROR_MONITORING_TOKEN}`,
      },
      body: JSON.stringify(errorLog),
    });
  } catch (error) {
    // Sanitize error message to prevent log injection
    const sanitizedError = error instanceof Error ? 
      error.message.replace(/[\r\n\t]/g, '') : 'Unknown error';
    
    logger.error('Failed to send error to monitoring service', { error: sanitizedError });
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