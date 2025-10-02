import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { 
  sanitizeInput, 
  securityValidation, 
  validateContentType,
  commonValidations 
} from './validation.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: { 'x-request-id': 'test-request-id' },
      path: '/test',
      method: 'POST',
      ip: '127.0.0.1',
      get: vi.fn(),
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe('sanitizeInput', () => {
    it('should sanitize string inputs', () => {
      mockReq.body = {
        name: '  John Doe  ',
        description: 'Test\x00string\x1F',
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.name).toBe('John Doe');
      expect(mockReq.body.description).toBe('Teststring');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize nested objects', () => {
      mockReq.body = {
        user: {
          name: '  Alice  ',
          profile: {
            bio: 'Hello\x00world',
          },
        },
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.user.name).toBe('Alice');
      expect(mockReq.body.user.profile.bio).toBe('Helloworld');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize arrays', () => {
      mockReq.body = {
        tags: ['  tag1  ', 'tag2\x00', '  tag3  '],
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      mockReq.query = {
        search: '  hello world  ',
        filter: 'test\x00value',
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query.search).toBe('hello world');
      expect(mockReq.query.filter).toBe('testvalue');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle null and undefined values', () => {
      mockReq.body = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.nullValue).toBeNull();
      expect(mockReq.body.undefinedValue).toBeUndefined();
      expect(mockReq.body.emptyString).toBe('');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('securityValidation', () => {
    it('should block SQL injection attempts', () => {
      mockReq.body = {
        query: 'SELECT * FROM users WHERE id = 1',
      };

      securityValidation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid input detected',
        message: 'Request contains potentially malicious content',
        code: 'MALICIOUS_INPUT',
        requestId: 'test-request-id',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block XSS attempts', () => {
      mockReq.body = {
        content: '<script>alert("xss")</script>',
      };

      securityValidation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block path traversal attempts', () => {
      mockReq.body = {
        path: '../../../etc/passwd',
      };

      securityValidation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block command injection attempts', () => {
      mockReq.body = {
        command: 'ls; rm -rf /',
      };

      securityValidation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow clean input', () => {
      mockReq.body = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      securityValidation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('validateContentType', () => {
    it('should allow valid content types', () => {
      const validator = validateContentType(['application/json']);
      mockReq.method = 'POST';
      (mockReq.get as any).mockReturnValue('application/json');

      validator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block invalid content types', () => {
      const validator = validateContentType(['application/json']);
      mockReq.method = 'POST';
      (mockReq.get as any).mockReturnValue('text/plain');

      validator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(415);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be one of: application/json',
        code: 'INVALID_CONTENT_TYPE',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should skip validation for GET requests', () => {
      const validator = validateContentType(['application/json']);
      mockReq.method = 'GET';

      validator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should skip validation when no content type', () => {
      const validator = validateContentType(['application/json']);
      mockReq.method = 'POST';
      (mockReq.get as any).mockReturnValue(undefined);

      validator(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('commonValidations', () => {
    it('should provide UUID validation', () => {
      const validation = commonValidations.uuid('id');
      expect(validation).toBeDefined();
    });

    it('should provide string validation', () => {
      const validation = commonValidations.string('name', 1, 100);
      expect(validation).toBeDefined();
    });

    it('should provide email validation', () => {
      const validation = commonValidations.email('email');
      expect(validation).toBeDefined();
    });

    it('should provide URL validation', () => {
      const validation = commonValidations.url('website');
      expect(validation).toBeDefined();
    });

    it('should provide image type validation', () => {
      const validation = commonValidations.imageType('fileType');
      expect(validation).toBeDefined();
    });

    it('should provide file size validation', () => {
      const validation = commonValidations.fileSize('fileSize', 1024);
      expect(validation).toBeDefined();
    });

    it('should provide enum validation', () => {
      const validation = commonValidations.enum('status', ['active', 'inactive']);
      expect(validation).toBeDefined();
    });

    it('should provide pagination validation', () => {
      expect(commonValidations.pagination.page).toBeDefined();
      expect(commonValidations.pagination.limit).toBeDefined();
    });
  });
});