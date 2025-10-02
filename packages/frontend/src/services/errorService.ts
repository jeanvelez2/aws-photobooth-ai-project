/**
 * Error Service
 * Centralized error handling, logging, and recovery management
 */

import { ProcessingError, ProcessingErrorType, RecoveryAction, ErrorContext, ErrorLogEntry } from '@photobooth/shared';

export interface ErrorServiceConfig {
  enableLogging: boolean;
  enableTelemetry: boolean;
  maxRetries: number;
  retryDelays: number[];
  logEndpoint?: string;
}

export class ErrorService {
  private config: ErrorServiceConfig;
  private errorLog: ErrorLogEntry[] = [];
  private retryAttempts: Map<string, number> = new Map();

  constructor(config: Partial<ErrorServiceConfig> = {}) {
    this.config = {
      enableLogging: true,
      enableTelemetry: false,
      maxRetries: 3,
      retryDelays: [1000, 2000, 4000], // Exponential backoff
      ...config,
    };
  }

  /**
   * Create a comprehensive error from various error sources
   */
  createError(
    type: ProcessingErrorType,
    originalError?: Error | any,
    context?: Partial<ErrorContext>
  ): ProcessingError {
    const errorMap = this.getErrorDefinitions();
    const errorDef = errorMap[type] || errorMap[ProcessingErrorType.INTERNAL_ERROR];

    const error: ProcessingError = {
      type,
      message: originalError?.message || errorDef.message,
      userMessage: errorDef.userMessage,
      retryable: errorDef.retryable,
      suggestions: errorDef.suggestions,
      recoveryActions: errorDef.recoveryActions,
      severity: errorDef.severity,
      timestamp: new Date(),
      requestId: this.generateRequestId(),
      context: {
        ...originalError,
        ...context,
      },
    };

    // Log the error
    this.logError(error, context);

    return error;
  }

  /**
   * Parse error from API response or caught exception
   */
  parseError(error: any, context?: Partial<ErrorContext>): ProcessingError {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return this.createError(ProcessingErrorType.NETWORK_ERROR, error, context);
    }

    // Handle HTTP errors
    if (error.status) {
      switch (error.status) {
        case 429:
          return this.createError(ProcessingErrorType.RATE_LIMITED, error, context);
        case 503:
          return this.createError(ProcessingErrorType.SERVICE_UNAVAILABLE, error, context);
        case 413:
          return this.createError(ProcessingErrorType.IMAGE_TOO_LARGE, error, context);
        case 400:
          if (error.code === 'INVALID_FORMAT') {
            return this.createError(ProcessingErrorType.INVALID_IMAGE_FORMAT, error, context);
          }
          break;
      }
    }

    // Handle processing-specific errors
    if (error.type && Object.values(ProcessingErrorType).includes(error.type)) {
      return this.createError(error.type, error, context);
    }

    // Default to internal error
    return this.createError(ProcessingErrorType.INTERNAL_ERROR, error, context);
  }

  /**
   * Check if an error can be retried
   */
  canRetry(error: ProcessingError, actionKey?: string): boolean {
    if (!error.retryable) return false;

    const key = actionKey || error.requestId || 'default';
    const attempts = this.retryAttempts.get(key) || 0;
    return attempts < this.config.maxRetries;
  }

  /**
   * Get retry delay for exponential backoff
   */
  getRetryDelay(error: ProcessingError, actionKey?: string): number {
    const key = actionKey || error.requestId || 'default';
    const attempts = this.retryAttempts.get(key) || 0;
    const index = Math.min(attempts, this.config.retryDelays.length - 1);
    return this.config.retryDelays[index] || 1000; // Default to 1 second
  }

  /**
   * Record a retry attempt
   */
  recordRetryAttempt(error: ProcessingError, actionKey?: string): void {
    const key = actionKey || error.requestId || 'default';
    const attempts = this.retryAttempts.get(key) || 0;
    this.retryAttempts.set(key, attempts + 1);
  }

  /**
   * Reset retry attempts for a specific action
   */
  resetRetryAttempts(actionKey: string): void {
    this.retryAttempts.delete(actionKey);
  }

  /**
   * Get error recovery actions based on error type and context
   */
  getRecoveryActions(error: ProcessingError, context?: any): RecoveryAction[] {
    const baseActions = error.recoveryActions || [];
    const contextualActions: RecoveryAction[] = [];

    // Add retry action if retryable and attempts remaining
    if (this.canRetry(error)) {
      contextualActions.push({
        type: 'retry',
        label: 'Try Again',
        description: 'Retry the same operation',
        primary: true,
      });
    }

    // Add context-specific actions
    if (context?.hasPhoto && error.type !== ProcessingErrorType.THEME_NOT_FOUND) {
      contextualActions.push({
        type: 'retakePhoto',
        label: 'Retake Photo',
        description: 'Take a new photo',
      });
    }

    if (context?.hasTheme && error.type === ProcessingErrorType.THEME_NOT_FOUND) {
      contextualActions.push({
        type: 'selectTheme',
        label: 'Choose Different Theme',
        description: 'Select another theme',
        primary: true,
      });
    }

    // Always provide start over option
    contextualActions.push({
      type: 'startOver',
      label: 'Start Over',
      description: 'Begin the process again',
    });

    return [...contextualActions, ...baseActions];
  }

  /**
   * Log error for monitoring and debugging
   */
  private logError(error: ProcessingError, context?: Partial<ErrorContext>): void {
    if (!this.config.enableLogging) return;

    const logEntry: ErrorLogEntry = {
      id: this.generateRequestId(),
      error,
      context: {
        component: 'unknown',
        action: 'unknown',
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...context,
      },
    };

    // Store locally
    this.errorLog.push(logEntry);

    // Console logging
    console.error('Error Service:', {
      type: error.type,
      message: error.message,
      severity: error.severity,
      context: logEntry.context,
    });

    // Send to remote logging service if configured
    if (this.config.logEndpoint) {
      this.sendErrorLog(logEntry).catch(console.warn);
    }

    // Trigger telemetry if enabled
    if (this.config.enableTelemetry) {
      this.sendTelemetry(logEntry);
    }
  }

  /**
   * Send error log to remote service
   */
  private async sendErrorLog(logEntry: ErrorLogEntry): Promise<void> {
    if (!this.config.logEndpoint) return;

    try {
      await fetch(this.config.logEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.warn('Failed to send error log:', error);
    }
  }

  /**
   * Send telemetry data
   */
  private sendTelemetry(logEntry: ErrorLogEntry): void {
    // Integration with analytics services (Google Analytics, etc.)
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'exception', {
        description: logEntry.error.type,
        fatal: logEntry.error.severity === 'critical',
        custom_map: {
          error_type: logEntry.error.type,
          component: logEntry.context.component,
        },
      });
    }
  }

  /**
   * Get error definitions with user-friendly messages and recovery actions
   */
  private getErrorDefinitions(): Record<ProcessingErrorType, Omit<ProcessingError, 'type' | 'timestamp' | 'requestId' | 'context'>> {
    return {
      [ProcessingErrorType.NO_FACE_DETECTED]: {
        message: 'No face detected in the image',
        userMessage: 'We couldn\'t detect a face in your photo. Please try again with a clearer image.',
        retryable: true,
        severity: 'medium',
        suggestions: [
          'Make sure your face is clearly visible',
          'Ensure good lighting',
          'Face the camera directly',
          'Remove any obstructions like sunglasses or masks',
        ],
        recoveryActions: [
          { type: 'retakePhoto', label: 'Retake Photo', primary: true },
          { type: 'goBack', label: 'Go Back' },
        ],
      },
      [ProcessingErrorType.MULTIPLE_FACES]: {
        message: 'Multiple faces detected',
        userMessage: 'We detected multiple faces in your photo. Please take a photo with only one person.',
        retryable: true,
        severity: 'medium',
        suggestions: [
          'Take a photo with only yourself in the frame',
          'Make sure no one else is visible in the background',
        ],
        recoveryActions: [
          { type: 'retakePhoto', label: 'Retake Photo', primary: true },
        ],
      },
      [ProcessingErrorType.POOR_IMAGE_QUALITY]: {
        message: 'Image quality too low',
        userMessage: 'The image quality is too low for processing. Please try with a higher quality photo.',
        retryable: true,
        severity: 'medium',
        suggestions: [
          'Use better lighting',
          'Make sure the image is not blurry',
          'Try taking the photo again with a steady hand',
          'Clean your camera lens',
        ],
        recoveryActions: [
          { type: 'retakePhoto', label: 'Retake Photo', primary: true },
        ],
      },
      [ProcessingErrorType.FACE_TOO_SMALL]: {
        message: 'Face is too small in the image',
        userMessage: 'Your face appears too small in the photo. Please move closer to the camera.',
        retryable: true,
        severity: 'medium',
        suggestions: [
          'Move closer to the camera',
          'Make sure your face takes up a good portion of the frame',
          'Zoom in if using the rear camera',
        ],
        recoveryActions: [
          { type: 'retakePhoto', label: 'Retake Photo', primary: true },
        ],
      },
      [ProcessingErrorType.EXTREME_POSE]: {
        message: 'Face pose is too extreme',
        userMessage: 'Please face the camera more directly for better results.',
        retryable: true,
        severity: 'medium',
        suggestions: [
          'Look directly at the camera',
          'Keep your head straight',
          'Avoid extreme angles or tilting',
        ],
        recoveryActions: [
          { type: 'retakePhoto', label: 'Retake Photo', primary: true },
        ],
      },
      [ProcessingErrorType.PROCESSING_TIMEOUT]: {
        message: 'Processing took too long',
        userMessage: 'Processing is taking longer than expected. Please try again.',
        retryable: true,
        severity: 'high',
        suggestions: [
          'Check your internet connection',
          'Try again in a few moments',
        ],
        recoveryActions: [
          { type: 'retry', label: 'Try Again', primary: true },
        ],
      },
      [ProcessingErrorType.THEME_NOT_FOUND]: {
        message: 'Selected theme not found',
        userMessage: 'The selected theme is not available. Please choose a different theme.',
        retryable: false,
        severity: 'medium',
        suggestions: [
          'Go back and select a different theme',
          'Refresh the page and try again',
        ],
        recoveryActions: [
          { type: 'selectTheme', label: 'Choose Different Theme', primary: true },
          { type: 'refresh', label: 'Refresh Page' },
        ],
      },
      [ProcessingErrorType.NETWORK_ERROR]: {
        message: 'Network connection failed',
        userMessage: 'Unable to connect to the server. Please check your internet connection.',
        retryable: true,
        severity: 'high',
        suggestions: [
          'Check your internet connection',
          'Try again in a few moments',
          'Switch to a different network if available',
        ],
        recoveryActions: [
          { type: 'retry', label: 'Try Again', primary: true },
          { type: 'refresh', label: 'Refresh Page' },
        ],
      },
      [ProcessingErrorType.SERVICE_UNAVAILABLE]: {
        message: 'Service temporarily unavailable',
        userMessage: 'The service is temporarily unavailable. Please try again later.',
        retryable: true,
        severity: 'high',
        suggestions: [
          'Try again in a few minutes',
          'Check if there are any service announcements',
        ],
        recoveryActions: [
          { type: 'retry', label: 'Try Again', primary: true },
        ],
      },
      [ProcessingErrorType.RATE_LIMITED]: {
        message: 'Too many requests',
        userMessage: 'You\'ve made too many requests. Please wait a moment before trying again.',
        retryable: true,
        severity: 'medium',
        suggestions: [
          'Wait a few minutes before trying again',
          'Avoid making multiple requests quickly',
        ],
        recoveryActions: [
          { type: 'retry', label: 'Try Again Later', primary: true },
        ],
      },
      [ProcessingErrorType.INVALID_IMAGE_FORMAT]: {
        message: 'Invalid image format',
        userMessage: 'The image format is not supported. Please use a JPEG or PNG image.',
        retryable: true,
        severity: 'medium',
        suggestions: [
          'Use a JPEG or PNG image',
          'Convert your image to a supported format',
        ],
        recoveryActions: [
          { type: 'retakePhoto', label: 'Take New Photo', primary: true },
        ],
      },
      [ProcessingErrorType.IMAGE_TOO_LARGE]: {
        message: 'Image file too large',
        userMessage: 'The image file is too large. Please use an image smaller than 10MB.',
        retryable: true,
        severity: 'medium',
        suggestions: [
          'Reduce the image size or quality',
          'Use a different image',
        ],
        recoveryActions: [
          { type: 'retakePhoto', label: 'Take New Photo', primary: true },
        ],
      },
      [ProcessingErrorType.UPLOAD_FAILED]: {
        message: 'Failed to upload image',
        userMessage: 'Failed to upload your image. Please check your connection and try again.',
        retryable: true,
        severity: 'high',
        suggestions: [
          'Check your internet connection',
          'Try again with a smaller image',
        ],
        recoveryActions: [
          { type: 'retry', label: 'Try Upload Again', primary: true },
          { type: 'retakePhoto', label: 'Retake Photo' },
        ],
      },
      [ProcessingErrorType.INTERNAL_ERROR]: {
        message: 'Internal processing error',
        userMessage: 'Something went wrong during processing. Please try again.',
        retryable: true,
        severity: 'high',
        suggestions: [
          'Try again in a few moments',
          'If the problem persists, try with a different photo',
        ],
        recoveryActions: [
          { type: 'retry', label: 'Try Again', primary: true },
          { type: 'startOver', label: 'Start Over' },
        ],
      },
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: ErrorLogEntry[];
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    this.errorLog.forEach(entry => {
      byType[entry.error.type] = (byType[entry.error.type] || 0) + 1;
      bySeverity[entry.error.severity] = (bySeverity[entry.error.severity] || 0) + 1;
    });

    const recent = this.errorLog
      .filter(entry => Date.now() - entry.context.timestamp.getTime() < 3600000) // Last hour
      .slice(-10);

    return {
      total: this.errorLog.length,
      byType,
      bySeverity,
      recent,
    };
  }
}

// Export singleton instance
export const errorService = new ErrorService({
  enableLogging: true,
  enableTelemetry: import.meta.env.PROD,
  logEndpoint: import.meta.env.VITE_ERROR_LOG_ENDPOINT,
});