import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body, param, query } from 'express-validator';
import { logger } from '../utils/logger.js';

/**
 * Middleware to handle validation errors from express-validator
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      path: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));

    logger.warn('Validation failed', {
      requestId: (req.headers['x-request-id'] as string)?.replace(/[\r\n\t]/g, '') || 'unknown',
      path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
      method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
      errors: errorDetails,
      ip: (req.ip || 'unknown').replace(/[\r\n\t]/g, ''),
    });

    res.status(400).json({
      error: 'Validation failed',
      details: errorDetails,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  next();
};

/**
 * Helper function to run validation chains
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize input before validation to prevent code injection
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
      }
      
      // Run validations with proper error handling
      for (const validation of validations) {
        await validation.run(req);
      }
      
      handleValidationErrors(req, res, next);
    } catch (error) {
      logger.error('Validation error', {
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
        path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      res.status(400).json({ error: 'Validation failed' });
    }
  };
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string)?.replace(/[\r\n\t]/g, '') || 'unknown';
  
  try {

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query and URL parameters (in-place modification)
    if (req.query && typeof req.query === 'object') {
      const sanitizedQuery = sanitizeObject(req.query);
      // Clear existing properties and add sanitized ones
      Object.keys(req.query).forEach(key => delete req.query[key]);
      Object.assign(req.query, sanitizedQuery);
    }
    if (req.params && typeof req.params === 'object') {
      const sanitizedParams = sanitizeObject(req.params);
      // Clear existing properties and add sanitized ones
      Object.keys(req.params).forEach(key => delete req.params[key]);
      Object.assign(req.params, sanitizedParams);
    }

    logger.debug('Input sanitization completed', { 
      requestId, 
      path: req.path || 'unknown'
    });
    next();
  } catch (error) {
    logger.error('Input sanitization failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path || 'unknown'
    });
    next();
  }
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof key === 'string' && isValidObjectKey(key)) {
        sanitized[sanitizeString(key)] = sanitizeObject(value);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate object key is safe
 */
function isValidObjectKey(key: string): boolean {
  try {
    // Only allow alphanumeric, underscore, hyphen, and dot
    return /^[a-zA-Z0-9_.-]+$/.test(key) && key.length <= 100;
  } catch (error) {
    // If validation fails, reject the key for safety
    return false;
  }
}

/**
 * Sanitize string input
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  try {
    return str
      .replace(/\0/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .normalize('NFC')
      .trim();
  } catch (error) {
    // Log sanitization error for debugging
    logger.warn('String sanitization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      inputLength: str.length
    });
    // If sanitization fails, return empty string for safety
    return '';
  }
}

/**
 * Common validation rules
 */
export const commonValidations = {
  // UUID validation
  uuid: (field: string) => 
    param(field).isUUID().withMessage(`${field} must be a valid UUID`),
  
  // String validation with length limits
  string: (field: string, minLength = 1, maxLength = 255) =>
    body(field)
      .isString()
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} must be a string between ${minLength} and ${maxLength} characters`),
  
  // Email validation
  email: (field: string) =>
    body(field)
      .isEmail()
      .normalizeEmail()
      .withMessage(`${field} must be a valid email address`),
  
  // URL validation
  url: (field: string) =>
    body(field)
      .isURL({ protocols: ['http', 'https'] })
      .withMessage(`${field} must be a valid URL`),
  
  // File type validation
  imageType: (field: string) =>
    body(field)
      .matches(/^image\/(jpeg|png|webp)$/)
      .withMessage(`${field} must be image/jpeg, image/png, or image/webp`),
  
  // File size validation (in bytes)
  fileSize: (field: string, maxSize = 10 * 1024 * 1024) =>
    body(field)
      .isInt({ min: 1, max: maxSize })
      .withMessage(`${field} must be between 1 byte and ${maxSize} bytes`),
  
  // Enum validation
  enum: (field: string, allowedValues: string[]) =>
    body(field)
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`),
  
  // Pagination validation
  pagination: {
    page: query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('page must be an integer between 1 and 1000'),
    limit: query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit must be an integer between 1 and 100'),
  },
};

// Suspicious patterns for security validation (created once for performance)
const suspiciousPatterns = [
      // SQL injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      // XSS patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      // Path traversal
      /\.\.\//g,
      /\.\.\\/g,
      // Command injection (more specific patterns)
      /;\s*(rm|del|format|shutdown|reboot|kill)/gi,
      /\|\s*(nc|netcat|wget|curl|bash|sh|cmd)/gi,
      /`[^`]*`/g, // Backtick command substitution
];

/**
 * Security-focused validation middleware
 */
export const securityValidation = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  const sanitizedRequestId = requestId?.replace(/[\r\n\t]/g, '') || 'unknown';
  
  try {

    let requestData: string;
    try {
      requestData = JSON.stringify({
        body: req.body || {},
        query: req.query || {},
        params: req.params || {},
      });
    } catch (stringifyError) {
      // If we can't stringify the data, skip validation but log the issue
      logger.warn('Failed to stringify request data for security validation', {
        requestId: sanitizedRequestId,
        error: stringifyError instanceof Error ? stringifyError.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
        path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
        method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
      });
      return next();
    }

  // Check for malicious patterns
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.warn('Malicious input detected', {
        requestId: sanitizedRequestId,
        ip: (req.ip || 'unknown').replace(/[\r\n\t]/g, ''),
        path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
        method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
        pattern: pattern.source?.replace(/[\r\n\t]/g, '') || 'unknown',
        userAgent: req.get('User-Agent')?.replace(/[\r\n\t]/g, '') || 'unknown',
      });

      return res.status(400).json({
        error: 'Invalid input detected',
        message: 'Request contains potentially malicious content',
        code: 'MALICIOUS_INPUT'
      });
    }
  }

  // Log successful security validation
  logger.debug('Security validation passed', {
    requestId: sanitizedRequestId,
    path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown'
  });
  
  next();
  } catch (error) {
    // If security validation fails, log the error but don't block the request
    logger.error('Security validation middleware error', {
      requestId: sanitizedRequestId,
      error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
      path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
      method: req.method?.replace(/[\r\n\t]/g, '') || 'UNKNOWN',
    });
    next();
  }
};

/**
 * Content type validation middleware
 */
export const validateContentType = (allowedTypes: string[]) => {
  // Pre-compute lowercase types for performance
  const lowerAllowedTypes = allowedTypes.map(type => type.toLowerCase());
  
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;
    const contentType = req.get('Content-Type');

    // Skip validation for GET requests and requests without body
    if (req.method === 'GET' || !contentType) {
      return next();
    }

    const lowerContentType = contentType.toLowerCase();
    const isAllowed = lowerAllowedTypes.some(type => 
      lowerContentType.includes(type)
    );

    if (!isAllowed) {
      logger.warn('Invalid content type', {
        requestId: requestId?.replace(/[\r\n\t]/g, '') || 'unknown',
        contentType: contentType?.replace(/[\r\n\t]/g, '') || 'unknown',
        allowedTypes,
        ip: (req.ip || 'unknown').replace(/[\r\n\t]/g, ''),
        path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown',
      });

      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
        code: 'INVALID_CONTENT_TYPE',
      });
    }

    // Log successful content type validation
    logger.debug('Content type validation passed', {
      requestId: requestId?.replace(/[\r\n\t]/g, '') || 'unknown',
      contentType: contentType?.replace(/[\r\n\t]/g, '') || 'unknown',
      path: req.path?.replace(/[\r\n\t]/g, '') || 'unknown'
    });

    next();
  };
};