import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Adaptive rate limiting based on endpoint sensitivity
export const adaptiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: (req: Request) => {
    // Different limits based on endpoint
    if (req.path.includes('/process')) return 5; // 5 processing requests per 15min
    if (req.path.includes('/upload')) return 20; // 20 uploads per 15min
    if (req.path.includes('/themes')) return 100; // 100 theme requests per 15min
    return 50; // Default limit
  },
  message: (req: Request) => ({
    error: 'Too many requests',
    retryAfter: Math.ceil(15 * 60), // seconds
    endpoint: req.path
  }),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP + User-Agent for better fingerprinting
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    return `${ip}:${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;
  }
});

// Burst protection for processing endpoints
export const burstProtection = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 3, // Max 3 requests per minute
  message: {
    error: 'Request burst detected',
    message: 'Please wait before making another processing request'
  },
  skip: (req: Request) => !req.path.includes('/process')
});

// IP reputation tracking
const suspiciousIPs = new Map<string, { count: number; lastSeen: number }>();

export function ipReputationCheck(req: Request, res: Response, next: Function) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  
  // Clean old entries (older than 1 hour)
  for (const [key, value] of suspiciousIPs.entries()) {
    if (now - value.lastSeen > 60 * 60 * 1000) {
      suspiciousIPs.delete(key);
    }
  }
  
  const reputation = suspiciousIPs.get(ip);
  if (reputation && reputation.count > 10) {
    return res.status(429).json({
      error: 'IP temporarily blocked',
      message: 'Too many suspicious requests from this IP'
    });
  }
  
  next();
}

export function markSuspiciousIP(ip: string) {
  const now = Date.now();
  const current = suspiciousIPs.get(ip) || { count: 0, lastSeen: now };
  suspiciousIPs.set(ip, {
    count: current.count + 1,
    lastSeen: now
  });
}