/**
 * Error Service Tests
 * Tests for comprehensive error handling and recovery management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcessingErrorType } from '@photobooth/shared';
import { ErrorService } from './errorService';

// Mock fetch for testing
global.fetch = vi.fn();

describe('ErrorService', () => {
  let errorService: ErrorService;

  beforeEach(() => {
    errorService = new ErrorService({
      enableLogging: true,
      enableTelemetry: false,
      maxRetries: 3,
      retryDelays: [1000, 2000, 4000],
    });
    vi.clearAllMocks();
  });

  describe('createError', () => {
    it('should create error with correct properties', () => {
      const error = errorService.createError(
        ProcessingErrorType.NO_FACE_DETECTED,
        new Error('Test error'),
        { component: 'TestComponent' }
      );

      expect(error.type).toBe(ProcessingErrorType.NO_FACE_DETECTED);
      expect(error.message).toBe('Test error');
      expect(error.userMessage).toBe('We couldn\'t detect a face in your photo. Please try again with a clearer image.');
      expect(error.retryable).toBe(true);
      expect(error.severity).toBe('medium');
      expect(error.suggestions).toContain('Make sure your face is clearly visible');
      expect(error.requestId).toBeDefined();
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should use default error definition for unknown types', () => {
      const error = errorService.createError(
        'UNKNOWN_ERROR' as ProcessingErrorType,
        new Error('Unknown error')
      );

      // The service preserves the original type but uses INTERNAL_ERROR's definition
      expect(error.type).toBe('UNKNOWN_ERROR');
      expect(error.severity).toBe('high'); // From INTERNAL_ERROR definition
      expect(error.userMessage).toBe('Something went wrong during processing. Please try again.');
    });
  });

  describe('parseError', () => {
    it('should parse network errors correctly', () => {
      const networkError = new TypeError('fetch failed');
      const error = errorService.parseError(networkError);

      expect(error.type).toBe(ProcessingErrorType.NETWORK_ERROR);
      expect(error.severity).toBe('high');
    });

    it('should parse HTTP status errors correctly', () => {
      const httpError = { status: 429, message: 'Rate limited' };
      const error = errorService.parseError(httpError);

      expect(error.type).toBe(ProcessingErrorType.RATE_LIMITED);
      expect(error.severity).toBe('medium');
    });

    it('should parse processing-specific errors', () => {
      const processingError = { 
        type: ProcessingErrorType.FACE_TOO_SMALL, 
        message: 'Face too small' 
      };
      const error = errorService.parseError(processingError);

      expect(error.type).toBe(ProcessingErrorType.FACE_TOO_SMALL);
      expect(error.userMessage).toContain('move closer to the camera');
    });
  });

  describe('retry management', () => {
    it('should allow retries within limit', () => {
      const error = errorService.createError(ProcessingErrorType.PROCESSING_TIMEOUT);
      
      expect(errorService.canRetry(error)).toBe(true);
      
      errorService.recordRetryAttempt(error);
      expect(errorService.canRetry(error)).toBe(true);
      
      errorService.recordRetryAttempt(error);
      errorService.recordRetryAttempt(error);
      expect(errorService.canRetry(error)).toBe(false);
    });

    it('should not allow retries for non-retryable errors', () => {
      const error = errorService.createError(ProcessingErrorType.THEME_NOT_FOUND);
      
      expect(errorService.canRetry(error)).toBe(false);
    });

    it('should calculate retry delays correctly', () => {
      const error = errorService.createError(ProcessingErrorType.INTERNAL_ERROR);
      
      expect(errorService.getRetryDelay(error)).toBe(1000);
      
      errorService.recordRetryAttempt(error);
      expect(errorService.getRetryDelay(error)).toBe(2000);
      
      errorService.recordRetryAttempt(error);
      expect(errorService.getRetryDelay(error)).toBe(4000);
    });

    it('should reset retry attempts', () => {
      const error = errorService.createError(ProcessingErrorType.INTERNAL_ERROR);
      const key = 'test-action';
      
      errorService.recordRetryAttempt(error, key);
      errorService.recordRetryAttempt(error, key);
      expect(errorService.canRetry(error, key)).toBe(true);
      
      errorService.resetRetryAttempts(key);
      expect(errorService.canRetry(error, key)).toBe(true);
    });
  });

  describe('recovery actions', () => {
    it('should provide retry action for retryable errors', () => {
      const error = errorService.createError(ProcessingErrorType.PROCESSING_TIMEOUT);
      const actions = errorService.getRecoveryActions(error);
      
      const retryAction = actions.find(action => action.type === 'retry');
      expect(retryAction).toBeDefined();
      expect(retryAction?.primary).toBe(true);
    });

    it('should provide contextual actions based on context', () => {
      const error = errorService.createError(ProcessingErrorType.NO_FACE_DETECTED);
      const actions = errorService.getRecoveryActions(error, { hasPhoto: true });
      
      const retakeAction = actions.find(action => action.type === 'retakePhoto');
      expect(retakeAction).toBeDefined();
    });

    it('should provide theme selection for theme errors', () => {
      const error = errorService.createError(ProcessingErrorType.THEME_NOT_FOUND);
      const actions = errorService.getRecoveryActions(error, { hasTheme: true });
      
      const selectThemeAction = actions.find(action => action.type === 'selectTheme');
      expect(selectThemeAction).toBeDefined();
      expect(selectThemeAction?.primary).toBe(true);
    });
  });

  describe('error statistics', () => {
    it('should track error statistics correctly', () => {
      errorService.createError(ProcessingErrorType.NO_FACE_DETECTED);
      errorService.createError(ProcessingErrorType.NO_FACE_DETECTED);
      errorService.createError(ProcessingErrorType.PROCESSING_TIMEOUT);
      
      const stats = errorService.getErrorStats();
      
      expect(stats.total).toBe(3);
      expect(stats.byType[ProcessingErrorType.NO_FACE_DETECTED]).toBe(2);
      expect(stats.byType[ProcessingErrorType.PROCESSING_TIMEOUT]).toBe(1);
      expect(stats.bySeverity.medium).toBe(2);
      expect(stats.bySeverity.high).toBe(1);
    });
  });

  describe('error logging', () => {
    it('should log errors to console', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      errorService.createError(ProcessingErrorType.INTERNAL_ERROR);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error Service:',
        expect.objectContaining({
          type: ProcessingErrorType.INTERNAL_ERROR,
          severity: 'high',
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should send error logs to remote endpoint when configured', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(new Response('OK'));
      
      const errorServiceWithEndpoint = new ErrorService({
        logEndpoint: 'https://api.example.com/errors',
      });
      
      errorServiceWithEndpoint.createError(ProcessingErrorType.INTERNAL_ERROR);
      
      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/errors',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('error severity mapping', () => {
    it('should assign correct severity levels', () => {
      const lowSeverityError = errorService.createError(ProcessingErrorType.NO_FACE_DETECTED);
      expect(lowSeverityError.severity).toBe('medium');
      
      const highSeverityError = errorService.createError(ProcessingErrorType.PROCESSING_TIMEOUT);
      expect(highSeverityError.severity).toBe('high');
      
      const criticalError = errorService.createError(ProcessingErrorType.SERVICE_UNAVAILABLE);
      expect(criticalError.severity).toBe('high');
    });
  });

  describe('error context', () => {
    it('should include context information in errors', () => {
      const context = {
        component: 'TestComponent',
        action: 'testAction',
        userId: 'user123',
      };
      
      const error = errorService.createError(
        ProcessingErrorType.INTERNAL_ERROR,
        new Error('Test'),
        context
      );
      
      expect(error.context).toMatchObject(context);
    });
  });
});