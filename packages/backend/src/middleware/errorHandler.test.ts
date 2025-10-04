import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ProcessingErrorType } from 'shared';
import { errorHandler, CustomError, ProcessingError, asyncHandler } from './errorHandler.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock fetch for monitoring
global.fetch = vi.fn();

describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      headers: { 'x-request-id': 'test-request-id' },
      method: 'GET',
      path: '/api/test',
      query: {},
      body: {},
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-user-agent'),
    };
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      set: vi.fn(),
    };
    
    mockNext = vi.fn();
  });

  describe('CustomError', () => {
    it('should create error with correct properties', () => {
      const error = new CustomError(
        'Test error', 
        400, 
        'TEST_ERROR',
        ProcessingErrorType.INVALID_IMAGE_FORMAT,
        'medium',
        { userId: 'test-user' }
      );
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.type).toBe(ProcessingErrorType.INVALID_IMAGE_FORMAT);
      expect(error.severity).toBe('medium');
      expect(error.context).toEqual({ userId: 'test-user' });
      expect(error.isOperational).toBe(true);
    });

    it('should default to status 500 and medium severity if not provided', () => {
      const error = new CustomError('Test error');
      
      expect(error.statusCode).toBe(500);
      expect(error.severity).toBe('medium');
    });
  });

  describe('ProcessingError', () => {
    it('should create processing error with correct severity mapping', () => {
      const error = new ProcessingError(
        ProcessingErrorType.NO_FACE_DETECTED,
        'No face found',
        400,
        { imageId: 'test-image' }
      );
      
      expect(error.type).toBe(ProcessingErrorType.NO_FACE_DETECTED);
      expect(error.message).toBe('No face found');
      expect(error.statusCode).toBe(400);
      expect(error.severity).toBe('medium');
      expect(error.context).toEqual({ imageId: 'test-image' });
    });

    it('should map critical errors correctly', () => {
      const error = new ProcessingError(
        ProcessingErrorType.SERVICE_UNAVAILABLE,
        'Service down'
      );
      
      expect(error.severity).toBe('critical');
    });
  });

  describe('errorHandler', () => {
    it('should handle ProcessingError correctly', () => {
      const error = new ProcessingError(
        ProcessingErrorType.NO_FACE_DETECTED,
        'No face detected',
        400,
        { imageId: 'test-image' }
      );
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.set).toHaveBeenCalledWith({
        'X-Request-ID': 'test-request-id',
        'X-Error-Type': ProcessingErrorType.NO_FACE_DETECTED,
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'No face detected',
          requestId: 'test-request-id',
          type: ProcessingErrorType.NO_FACE_DETECTED,
          severity: 'medium',
          retryable: false, // NO_FACE_DETECTED is not retryable by default
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle CustomError correctly', () => {
      const error = new CustomError('Test error', 400, 'TEST_ERROR');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'Test error',
          requestId: 'test-request-id',
          code: 'TEST_ERROR',
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle generic Error correctly with public message', () => {
      const error = new Error('Internal database connection failed');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'Internal server error', // Public message, not internal details
          requestId: expect.any(String),
        })
      );
    });

    it('should include additional details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new CustomError(
        'Test error',
        400,
        'TEST_ERROR',
        ProcessingErrorType.INTERNAL_ERROR,
        'high',
        { debug: 'info' }
      );
      error.stack = 'test stack trace';
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: 'test stack trace',
          context: { debug: 'info' },
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should generate request ID if not provided', () => {
      mockReq.headers = {};
      const error = new CustomError('Test error');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.stringMatching(/^req_\d+_\w+$/),
        })
      );
    });

    // Test that sensitive fields like passwords and tokens are redacted in logs
    it('should sanitize sensitive data in request body', async () => {
      mockReq.body = {
        username: 'test',
        password: process.env.TEST_PASSWORD || 'test-password',
        token: process.env.TEST_TOKEN || 'test-token',
        data: 'normal-data',
      };
      
      const error = new CustomError('Test error');
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      // Check that logger was called with sanitized body
      const { logger } = await import('../utils/logger.js');
      expect(logger.warn).toHaveBeenCalledWith(
        'Application error',
        expect.objectContaining({
          request: expect.objectContaining({
            body: {
              username: 'test',
              // amazonq-ignore-next-line
              password: '[REDACTED]',
              // amazonq-ignore-next-line
              token: '[REDACTED]',
              data: 'normal-data',
            },
          }),
        })
      );
    });

    // Test that errors are sent to external monitoring service when endpoint is configured
    it('should send to monitoring service when configured', async () => {
      const originalEndpoint = process.env.ERROR_MONITORING_ENDPOINT;
      process.env.ERROR_MONITORING_ENDPOINT = 'https://monitoring.example.com/errors';
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any);
      
      const error = new ProcessingError(ProcessingErrorType.INTERNAL_ERROR, 'Test error');
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      // Wait for async monitoring call
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(fetch).toHaveBeenCalledWith(
        'https://monitoring.example.com/errors',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      
      process.env.ERROR_MONITORING_ENDPOINT = originalEndpoint;
    });

    // Test that retryable status is correctly determined based on error type
    it('should determine retryable status correctly', () => {
      const retryableError = new ProcessingError(
        ProcessingErrorType.PROCESSING_TIMEOUT,
        'Timeout'
      );
      
      errorHandler(retryableError, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryable: true,
        })
      );
      
      const nonRetryableError = new ProcessingError(
        ProcessingErrorType.NO_FACE_DETECTED,
        'No face'
      );
      
      errorHandler(nonRetryableError, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryable: false,
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async function', async () => {
      const asyncFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(mockReq as Request, mockRes as Response, mockNext);
      
      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and forward async errors', async () => {
      const error = new Error('Async error');
      const asyncFn = vi.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});