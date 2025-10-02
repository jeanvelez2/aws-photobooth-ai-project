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
      requestId: req.headers['x-request-id'],
      path: req.path,
      method: req.method,
      errors: errorDetails,
      ip: req.ip,
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
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Handle validation errors
    handleValidationErrors(req, res, next);
  };
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  logger.debug('Input sanitization completed', { requestId, path: req.path });
  next();
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
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize string input
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize Unicode
    .normalize('NFC')
    // Trim whitespace
    .trim();
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

/**
 * Security-focused validation middleware
 */
export const securityValidation = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
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

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Check for malicious patterns
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.warn('Malicious input detected', {
        requestId,
        ip: req.ip,
        path: req.path,
        method: req.method,
        pattern: pattern.source,
        userAgent: req.get('User-Agent'),
      });

      return res.status(400).json({
        error: 'Invalid input detected',
        message: 'Request contains potentially malicious content',
        code: 'MALICIOUS_INPUT',
        requestId,
      });
    }
  }

  next();
};

/**
 * Content type validation middleware
 */
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;
    const contentType = req.get('Content-Type');

    // Skip validation for GET requests and requests without body
    if (req.method === 'GET' || !contentType) {
      return next();
    }

    const isAllowed = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isAllowed) {
      logger.warn('Invalid content type', {
        requestId,
        contentType,
        allowedTypes,
        ip: req.ip,
        path: req.path,
      });

      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
        code: 'INVALID_CONTENT_TYPE',
      });
    }

    next();
  };
};