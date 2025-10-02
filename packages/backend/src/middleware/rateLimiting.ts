import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Enhanced rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create rate limiter with enhanced logging and monitoring
 */
export const createRateLimiter = (config: RateLimitConfig) => {
  // Skip rate limiting in test environment
  if (process.env.NODE_ENV === 'test') {
    return (req: Request, res: Response, next: Function) => next();
  }

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: true,
      message: config.message,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    keyGenerator: config.keyGenerator || ((req: Request) => req.ip || 'unknown'),
    handler: (req: Request, res: Response) => {
      const requestId = req.headers['x-request-id'] as string;
      
      logger.warn('Rate limit exceeded', {
        requestId,
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        windowMs: config.windowMs,
        maxRequests: config.max,
      });

      // Send security alert for excessive rate limiting
      if ((req as any).rateLimit && (req as any).rateLimit.remaining === 0) {
        logger.error('Potential abuse detected - rate limit hit', {
          requestId,
          ip: req.ip,
          path: req.path,
          totalHits: (req as any).rateLimit.totalHits,
          resetTime: new Date((req as any).rateLimit.resetTime || Date.now()),
        });
      }

      res.status(429).json({
        error: true,
        message: config.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(config.windowMs / 1000),
        requestId,
      });
    },

  });
};

/**
 * General API rate limiter (10 requests per minute per IP)
 */
export const generalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: 'Too many requests from this IP, please try again later.',
});

/**
 * Strict rate limiter for processing endpoints (3 requests per minute per IP)
 */
export const processingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 processing requests per minute per IP
  message: 'Too many processing requests from this IP, please wait before submitting another.',
  skipSuccessfulRequests: false,
  skipFailedRequests: true, // Don't count failed requests against limit
});

/**
 * Upload rate limiter (5 uploads per minute per IP)
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 upload requests per minute per IP
  message: 'Too many upload requests from this IP, please wait before uploading again.',
});

/**
 * Lenient rate limiter for health checks and static content
 */
export const healthCheckRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  message: 'Too many health check requests from this IP.',
  skipSuccessfulRequests: true,
});

/**
 * Progressive rate limiting based on user behavior
 */
export const progressiveRateLimiter = (req: Request, res: Response, next: Function) => {
  const requestId = req.headers['x-request-id'] as string;
  const ip = req.ip;
  
  // This could be enhanced with Redis for distributed rate limiting
  // For now, we'll use the basic rate limiter with enhanced monitoring
  
  // Check if IP has been flagged for suspicious activity
  const suspiciousIPs = new Set(); // In production, this would be in Redis/database
  
  if (suspiciousIPs.has(ip)) {
    logger.warn('Request from flagged IP', {
      requestId,
      ip,
      path: req.path,
      method: req.method,
    });
    
    // Apply stricter rate limiting for flagged IPs
    const strictLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2, // Very strict limit
      message: 'Your IP has been flagged for suspicious activity. Please contact support.',
    });
    
    return strictLimiter(req, res, next as any);
  }
  
  next();
};

/**
 * Distributed rate limiting store interface (for future Redis implementation)
 */
export interface RateLimitStore {
  incr(key: string): Promise<{ totalHits: number; resetTime?: Date }>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
}

/**
 * Memory-based rate limit store (for development/single instance)
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private windowMs: number;

  constructor(windowMs: number = 60000) {
    this.windowMs = windowMs;
    
    // Clean up expired entries every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (now > value.resetTime) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  async incr(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const now = Date.now();
    const resetTime = now + this.windowMs;
    
    const existing = this.store.get(key);
    
    if (!existing || now > existing.resetTime) {
      // Create new entry or reset expired entry
      this.store.set(key, { count: 1, resetTime });
      return { totalHits: 1, resetTime: new Date(resetTime) };
    } else {
      // Increment existing entry
      existing.count++;
      return { totalHits: existing.count, resetTime: new Date(existing.resetTime) };
    }
  }

  async decrement(key: string): Promise<void> {
    const existing = this.store.get(key);
    if (existing && existing.count > 0) {
      existing.count--;
    }
  }

  async resetKey(key: string): Promise<void> {
    this.store.delete(key);
  }
}