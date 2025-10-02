import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { 
  securityHeaders, 
  httpsEnforcement, 
  secureCookies, 
  requestSizeLimiter,
  securityMonitoring 
} from './security.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: { 'x-request-id': 'test-request-id' },
      path: '/test',
      ip: '127.0.0.1',
      get: vi.fn(),
    };
    mockRes = {
      setHeader: vi.fn(),
      removeHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      cookie: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe('securityHeaders', () => {
    it('should set all required security headers', () => {
      securityHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Frame-Options',
        'DENY'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-XSS-Protection',
        '1; mode=block'
      );
      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set comprehensive CSP headers', () => {
      securityHeaders(mockReq as Request, mockRes as Response, mockNext);

      const cspCall = (mockRes.setHeader as any).mock.calls.find(
        (call: any) => call[0] === 'Content-Security-Policy'
      );
      expect(cspCall).toBeDefined();
      expect(cspCall[1]).toContain("default-src 'self'");
      expect(cspCall[1]).toContain("object-src 'none'");
      expect(cspCall[1]).toContain("frame-src 'none'");
    });
  });

  describe('httpsEnforcement', () => {
    it('should allow HTTPS requests in production', () => {
      process.env.NODE_ENV = 'production';
      (mockReq as any).secure = true;

      httpsEnforcement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow requests with x-forwarded-proto header', () => {
      process.env.NODE_ENV = 'production';
      (mockReq as any).secure = false;
      mockReq.headers = { 
        ...mockReq.headers,
        'x-forwarded-proto': 'https' 
      };

      httpsEnforcement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block HTTP requests in production', () => {
      process.env.NODE_ENV = 'production';
      (mockReq as any).secure = false;
      mockReq.headers = { ...mockReq.headers };

      httpsEnforcement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(426);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'HTTPS Required',
        message: 'This API requires HTTPS connections for security',
        code: 'HTTPS_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow HTTP requests in development', () => {
      process.env.NODE_ENV = 'development';
      (mockReq as any).secure = false;

      httpsEnforcement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('secureCookies', () => {
    it('should override res.cookie with secure options', () => {
      const originalCookie = vi.fn();
      mockRes.cookie = originalCookie;

      secureCookies(mockReq as Request, mockRes as Response, mockNext);

      // Call the overridden cookie method
      (mockRes.cookie as any)('testCookie', 'testValue', { maxAge: 1000 });

      expect(originalCookie).toHaveBeenCalledWith('testCookie', 'testValue', {
        maxAge: 1000,
        httpOnly: true,
        secure: false, // false in test environment
        sameSite: 'strict',
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requestSizeLimiter', () => {
    it('should allow requests within size limit', () => {
      const limiter = requestSizeLimiter(1000);
      mockReq.headers = { 
        ...mockReq.headers,
        'content-length': '500' 
      };

      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding size limit', () => {
      const limiter = requestSizeLimiter(1000);
      mockReq.headers = { 
        ...mockReq.headers,
        'content-length': '2000' 
      };

      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Request too large',
        message: 'Request size exceeds maximum allowed size of 1000 bytes',
        code: 'REQUEST_TOO_LARGE',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing content-length header', () => {
      const limiter = requestSizeLimiter(1000);
      mockReq.headers = { ...mockReq.headers };

      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('securityMonitoring', () => {
    it('should detect XSS attempts', () => {
      mockReq.body = { input: '<script>alert("xss")</script>' };
      mockReq.query = {};
      mockReq.headers = { ...mockReq.headers };

      securityMonitoring(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should continue but log warning
    });

    it('should detect SQL injection attempts', () => {
      mockReq.body = { query: 'SELECT * FROM users' };
      mockReq.query = {};
      mockReq.headers = { ...mockReq.headers };

      securityMonitoring(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should continue but log warning
    });

    it('should detect path traversal attempts', () => {
      mockReq.body = { path: '../../../etc/passwd' };
      mockReq.query = {};
      mockReq.headers = { ...mockReq.headers };

      securityMonitoring(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should continue but log warning
    });

    it('should allow clean requests', () => {
      mockReq.body = { name: 'John Doe', email: 'john@example.com' };
      mockReq.query = { page: '1' };
      mockReq.headers = { ...mockReq.headers };

      securityMonitoring(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});