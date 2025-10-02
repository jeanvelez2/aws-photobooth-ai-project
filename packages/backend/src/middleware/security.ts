import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Enhanced security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;

  // Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Content Security Policy (Enhanced)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Allow inline scripts for React
    "style-src 'self' 'unsafe-inline'", // Allow inline styles for CSS-in-JS
    "img-src 'self' data: https: blob:", // Allow images from various sources
    "font-src 'self' data:",
    "connect-src 'self' https://api.amazonaws.com https://*.amazonaws.com", // AWS services
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'PhotoboothAPI');

  logger.debug('Security headers applied', { requestId, path: req.path });
  next();
};

/**
 * HTTPS enforcement middleware
 */
export const httpsEnforcement = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;

  // Skip HTTPS enforcement in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Allow HTTP for health check endpoints from ELB
  if (req.path === '/api/health' && req.get('User-Agent')?.includes('ELB-HealthChecker')) {
    return next();
  }

  // Check if request is secure
  const isSecure = req.secure || 
                   req.headers['x-forwarded-proto'] === 'https' ||
                   req.headers['x-forwarded-ssl'] === 'on';

  if (!isSecure) {
    logger.warn('Insecure HTTP request blocked', {
      requestId,
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
    });

    return res.status(426).json({
      error: 'HTTPS Required',
      message: 'This API requires HTTPS connections for security',
      code: 'HTTPS_REQUIRED',
    });
  }

  next();
};

/**
 * Secure cookie configuration middleware
 */
export const secureCookies = (req: Request, res: Response, next: NextFunction) => {
  // Override res.cookie to add security flags
  const originalCookie = res.cookie.bind(res);
  
  res.cookie = function(name: string, value: any, options: any = {}) {
    const secureOptions = {
      ...options,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: options.maxAge || 24 * 60 * 60 * 1000, // 24 hours default
    };

    return originalCookie(name, value, secureOptions);
  };

  next();
};

/**
 * Request size limiting middleware
 */
export const requestSizeLimiter = (maxSizeBytes: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSizeBytes) {
      logger.warn('Request size limit exceeded', {
        requestId,
        contentLength,
        maxSize: maxSizeBytes,
        ip: req.ip,
        path: req.path,
      });

      return res.status(413).json({
        error: 'Request too large',
        message: `Request size exceeds maximum allowed size of ${maxSizeBytes} bytes`,
        code: 'REQUEST_TOO_LARGE',
      });
    }

    next();
  };
};

/**
 * IP whitelist middleware (for admin endpoints)
 */
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;
    const clientIP = req.ip;

    // Skip in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    if (allowedIPs.length > 0 && clientIP && !allowedIPs.includes(clientIP)) {
      logger.warn('IP not in whitelist', {
        requestId,
        ip: clientIP,
        path: req.path,
        allowedIPs,
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized to access this resource',
        code: 'IP_NOT_ALLOWED',
      });
    }

    next();
  };
};

/**
 * Security monitoring middleware
 */
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const suspiciousPatterns = [
      /\.\.\//g, // Path traversal
      /<script/gi, // XSS attempts
      /union.*select/gi, // SQL injection
      /javascript:/gi, // JavaScript injection
      /vbscript:/gi, // VBScript injection
      /onload=/gi, // Event handler injection
      /onerror=/gi, // Error handler injection
    ];

    let requestData: string;
    try {
      requestData = JSON.stringify({
        url: req.url,
        query: req.query || {},
        body: req.body || {},
        headers: req.headers || {},
      });
    } catch (stringifyError) {
      // If we can't stringify the data, skip monitoring but continue
      logger.warn('Failed to stringify request data for security monitoring', {
        requestId,
        error: stringifyError instanceof Error ? stringifyError.message : 'Unknown error',
        path: req.path,
        method: req.method,
      });
      return next();
    }

    // Check for suspicious patterns
    const suspiciousActivity = suspiciousPatterns.some(pattern => 
      pattern.test(requestData)
    );

    if (suspiciousActivity) {
      logger.warn('Suspicious request detected', {
        requestId,
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        suspiciousContent: requestData.substring(0, 500), // Limit logged content
      });

      // Could implement additional actions here:
      // - Block the request
      // - Add to temporary blacklist
      // - Send alert to security team
    }

    next();
  } catch (error) {
    // If security monitoring fails, log the error but don't block the request
    logger.error('Security monitoring middleware error', {
      requestId: req.headers['x-request-id'],
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method,
    });
    next();
  }
};