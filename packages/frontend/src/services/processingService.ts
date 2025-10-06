/**
 * Processing Service
 * Handles image processing requests, status polling, and result management
 */

import { ProcessingRequest, ProcessingResult, ProcessingError, ProcessingErrorType } from '@photobooth/shared';

// Re-export for components
export type { ProcessingError };
import { errorService } from './errorService';
import { gracefulDegradationService } from './gracefulDegradation';

export interface ProcessingOptions {
  onProgress?: (progress: number) => void;
  onStatusChange?: (status: ProcessingResult['status']) => void;
  onError?: (error: ProcessingError) => void;
  signal?: AbortSignal;
  enableFallback?: boolean;
}

export class ProcessingService {
  private readonly API_BASE_URL: string;
  private readonly POLLING_INTERVAL = 2000; // 2 seconds
  private readonly MAX_PROCESSING_TIME = 60000; // 60 seconds
  private readonly circuitBreaker = new Map<string, { failures: number; lastFailure: number; isOpen: boolean }>();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly activeRequests = new Set<string>(); // Track active requests

  constructor(apiBaseUrl?: string) {
    this.API_BASE_URL = apiBaseUrl || import.meta.env.VITE_API_URL || '/api';
  }

  private checkCircuitBreaker(endpoint: string): boolean {
    const circuit = this.circuitBreaker.get(endpoint);
    if (!circuit) return true;

    if (circuit.isOpen) {
      const now = Date.now();
      if (now - circuit.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
        console.log(`Circuit breaker reset for ${endpoint}`);
        circuit.isOpen = false;
        circuit.failures = 0;
        return true;
      }
      console.log(`Circuit breaker is open for ${endpoint}, blocking request`);
      return false;
    }
    return true;
  }

  private recordFailure(endpoint: string): void {
    const circuit = this.circuitBreaker.get(endpoint) || { failures: 0, lastFailure: 0, isOpen: false };
    circuit.failures++;
    circuit.lastFailure = Date.now();
    
    if (circuit.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      circuit.isOpen = true;
    }
    
    this.circuitBreaker.set(endpoint, circuit);
  }

  private recordSuccess(endpoint: string): void {
    this.circuitBreaker.delete(endpoint);
  }

  /**
   * Reset circuit breaker for manual retry
   */
  resetCircuitBreaker(endpoint: string = 'process'): void {
    console.log(`Manually resetting circuit breaker for ${endpoint}`);
    this.circuitBreaker.delete(endpoint);
    // Also clear active requests to allow retries
    this.activeRequests.clear();
  }

  /**
   * Test backend connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.warn('Backend connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Start image processing with error handling and fallback
   */
  async startProcessing(request: ProcessingRequest, options: ProcessingOptions = {}): Promise<ProcessingResult> {
    const { enableFallback = true, onError } = options; // Enable fallback by default
    const endpoint = 'process';
    const requestKey = `${request.photoId}-${request.themeId}`;

    // Prevent duplicate requests
    if (this.activeRequests.has(requestKey)) {
      const error = errorService.createError(
        ProcessingErrorType.INTERNAL_ERROR,
        new Error('A processing request for this photo and theme is already in progress'),
        { component: 'ProcessingService', action: 'startProcessing' }
      );
      onError?.(error);
      throw error;
    }

    this.activeRequests.add(requestKey);

    try {
      // Check circuit breaker
      if (!this.checkCircuitBreaker(endpoint)) {
        // Test if backend is actually available before throwing error
        const isBackendAvailable = await this.testConnection();
        if (isBackendAvailable) {
          // Backend is available, reset circuit breaker
          console.log('Backend is available, resetting circuit breaker');
          this.resetCircuitBreaker(endpoint);
        } else {
          const error = errorService.createError(
            ProcessingErrorType.SERVICE_UNAVAILABLE,
            new Error('Service temporarily unavailable due to repeated failures. The backend service appears to be down.'),
            { 
              component: 'ProcessingService', 
              action: 'startProcessing',

            }
          );
          onError?.(error);
          throw error;
        }
      }

      // Validate executor functions before execution
      const safeMainExecutor = async () => {
        console.log('Sending processing request:', request);
        const response = await fetch(`${this.API_BASE_URL}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: options.signal,
        });
        console.log('Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          let errorType: ProcessingErrorType;
          switch (response.status) {
            case 400:
              errorType = errorData.code === 'NO_FACE_DETECTED' 
                ? ProcessingErrorType.NO_FACE_DETECTED 
                : ProcessingErrorType.INVALID_IMAGE_FORMAT;
              break;
            case 413:
              errorType = ProcessingErrorType.IMAGE_TOO_LARGE;
              break;
            case 429:
              errorType = ProcessingErrorType.RATE_LIMITED;
              break;
            case 503:
              errorType = ProcessingErrorType.SERVICE_UNAVAILABLE;
              break;
            default:
              errorType = ProcessingErrorType.INTERNAL_ERROR;
          }

          const error = errorService.createError(errorType, new Error(errorData.message || `HTTP ${response.status}`), {
            component: 'ProcessingService',
            action: 'startProcessing',
            httpStatus: response.status,
          });

          onError?.(error);
          throw error;
        }

        const result = await response.json();
        
        if (!result.id) {
          throw new Error('Invalid response: missing job ID');
        }
        
        this.recordSuccess(endpoint);
        return result;
      };
      
      const safeFallbackExecutor = enableFallback ? async () => {
        const fallbacks = gracefulDegradationService.getProcessingFallbacks();
        const queueResult = await fallbacks.queueForLater(request);
        
        return {
          id: `queued_${Date.now()}`,
          status: 'queued' as const,
          progress: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          request,
          message: 'Your image has been queued for processing. Please try again later.',
          queuePosition: queueResult.position || 1,
        };
      } : undefined;
      
      if (typeof safeMainExecutor !== 'function') {
        throw new Error('Invalid main executor function');
      }
      
      if (safeFallbackExecutor && typeof safeFallbackExecutor !== 'function') {
        throw new Error('Invalid fallback executor function');
      }
      
      return await gracefulDegradationService.executeWithFallback(
        'processing',
        safeMainExecutor,
        safeFallbackExecutor
      );
    } catch (error) {
      this.recordFailure(endpoint);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = errorService.createError(
          ProcessingErrorType.SERVICE_UNAVAILABLE,
          new Error(`Backend service is unavailable. Please try again later. (${(error as Error).message})`),
          {
            component: 'ProcessingService',
            action: 'startProcessing',
          }
        );
        onError?.(networkError);
        throw networkError;
      }
      
      const processedError = errorService.parseError(error as Error, {
        component: 'ProcessingService',
        action: 'startProcessing',
      });
      onError?.(processedError);
      throw processedError;
    } finally {
      this.activeRequests.delete(requestKey);
    }
  }

  /**
   * Get processing status with error handling
   */
  async getProcessingStatus(id: string, options: ProcessingOptions = {}): Promise<ProcessingResult> {
    const { onError } = options;

    // Validate job ID
    if (!id || id === 'undefined') {
      const error = errorService.createError(
        ProcessingErrorType.INTERNAL_ERROR,
        new Error('Invalid job ID provided'),
        {
          component: 'ProcessingService',
          action: 'getProcessingStatus',
          jobId: id,
        }
      );
      onError?.(error);
      throw error;
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/process/${id}`, {
        method: 'GET',
        signal: options.signal,
      });

      if (!response.ok) {
        const errorType = response.status === 404 
          ? ProcessingErrorType.INTERNAL_ERROR 
          : ProcessingErrorType.SERVICE_UNAVAILABLE;
        
        const error = errorService.createError(errorType, new Error(`Status check failed: ${response.status}`), {
          component: 'ProcessingService',
          action: 'getProcessingStatus',
          httpStatus: response.status,
          jobId: id,
        });

        onError?.(error);
        throw error;
      }

      return response.json();
    } catch (error) {
      // Handle network errors specifically
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = errorService.createError(
          ProcessingErrorType.SERVICE_UNAVAILABLE,
          new Error(`Backend service is unavailable. Please try again later. (${error.message})`),
          {
            component: 'ProcessingService',
            action: 'getProcessingStatus',
            jobId: id,
          }
        );
        onError?.(networkError);
        throw networkError;
      }
      
      const processedError = errorService.parseError(error as Error, {
        component: 'ProcessingService',
        action: 'getProcessingStatus',
        jobId: id,
      });
      onError?.(processedError);
      throw processedError;
    }
  }

  /**
   * Poll processing status with progress updates and enhanced error handling
   */
  async pollProcessingStatus(
    id: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const { onProgress, onStatusChange, onError, signal } = options;
    
    // Don't poll for queued jobs - they're fallback responses
    if (id.startsWith('queued_')) {
      const error = errorService.createError(
        ProcessingErrorType.SERVICE_UNAVAILABLE,
        new Error('Service is currently unavailable. Your request has been queued.'),
        {
          component: 'ProcessingService',
          action: 'pollProcessingStatus',
          jobId: id,
        }
      );
      onError?.(error);
      throw error;
    }
    
    const startTime = Date.now();
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          // Check if cancelled
          if (signal?.aborted) {
            const error = errorService.createError(ProcessingErrorType.INTERNAL_ERROR, new Error('Processing cancelled'), {
              component: 'ProcessingService',
              action: 'pollProcessingStatus',
              jobId: id,
            });
            onError?.(error);
            reject(error);
            return;
          }

          // Check timeout
          const elapsed = Date.now() - startTime;
          if (elapsed > this.MAX_PROCESSING_TIME) {
            // Try to get final status before timing out
            try {
              const finalResult = await this.getProcessingStatus(id, { onError });
              if (finalResult.status === 'completed') {
                resolve(finalResult);
                return;
              }
            } catch (e) {
              console.warn('Failed to get final status before timeout:', e);
            }
            
            const error = errorService.createError(ProcessingErrorType.PROCESSING_TIMEOUT, new Error(`Processing timeout after ${elapsed}ms. Backend may be overloaded.`), {
              component: 'ProcessingService',
              action: 'pollProcessingStatus',
              jobId: id,
              elapsed,
            });
            onError?.(error);
            reject(error);
            return;
          }

          const result = await this.getProcessingStatus(id, { onError });
          
          // Reset consecutive errors on successful response
          consecutiveErrors = 0;
          
          // Debug logging
          console.log(`Processing status for ${id}:`, {
            status: result.status,
            elapsed: elapsed,
            result: result
          });
          
          // Update progress based on elapsed time and status
          if (onProgress) {
            const progress = this.calculateProgress(result.status, elapsed);
            onProgress(progress);
          }

          // Notify status change
          if (onStatusChange) {
            onStatusChange(result.status);
          }

          // Check if processing failed
          if (result.status === 'failed') {
            const error = errorService.parseError(result.error || 'Processing failed', {
              component: 'ProcessingService',
              action: 'pollProcessingStatus',
              jobId: id,
            });
            onError?.(error);
            reject(error);
            return;
          }

          // Check if processing is complete
          if (result.status === 'completed') {
            resolve(result);
            return;
          }

          // Continue polling
          setTimeout(poll, this.POLLING_INTERVAL);
        } catch (error) {
          consecutiveErrors++;
          
          // If too many consecutive errors, give up
          if (consecutiveErrors >= maxConsecutiveErrors) {
            const processedError = errorService.createError(
              ProcessingErrorType.SERVICE_UNAVAILABLE,
              error as Error,
              {
                component: 'ProcessingService',
                action: 'pollProcessingStatus',
                jobId: id,
                consecutiveErrors,
              }
            );
            onError?.(processedError);
            reject(processedError);
            return;
          }

          // Continue polling with exponential backoff
          const backoffDelay = this.POLLING_INTERVAL * Math.pow(2, consecutiveErrors - 1);
          setTimeout(poll, Math.min(backoffDelay, 10000)); // Max 10 seconds
        }
      };

      // Start polling
      poll();
    });
  }

  /**
   * Calculate progress based on status and elapsed time
   */
  private calculateProgress(status: ProcessingResult['status'], elapsed: number): number {
    switch (status) {
      case 'processing':
        // Estimate progress based on elapsed time (max 15 seconds expected)
        const estimatedProgress = Math.min((elapsed / 15000) * 90, 90);
        return Math.round(estimatedProgress);
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Retry processing with the same parameters and enhanced error handling
   */
  async retryProcessing(originalRequest: ProcessingRequest, options: ProcessingOptions = {}): Promise<ProcessingResult> {
    const { onError } = options;

    try {
      // Check if retry is allowed
      const canRetry = errorService.canRetry({
        type: ProcessingErrorType.INTERNAL_ERROR,
        message: 'Retry attempt',
        userMessage: 'Retrying processing',
        retryable: true,
        severity: 'medium',
      } as ProcessingError, originalRequest.photoId);

      if (!canRetry) {
        const error = errorService.createError(ProcessingErrorType.INTERNAL_ERROR, new Error('Maximum retry attempts reached'), {
          component: 'ProcessingService',
          action: 'retryProcessing',
        });
        onError?.(error);
        throw error;
      }

      // Record retry attempt
      errorService.recordRetryAttempt({
        type: ProcessingErrorType.INTERNAL_ERROR,
        message: 'Retry attempt',
        userMessage: 'Retrying processing',
        retryable: true,
        severity: 'medium',
      } as ProcessingError, originalRequest.photoId);

      // Add delay for exponential backoff
      const delay = errorService.getRetryDelay({
        type: ProcessingErrorType.INTERNAL_ERROR,
        message: 'Retry attempt',
        userMessage: 'Retrying processing',
        retryable: true,
        severity: 'medium',
      } as ProcessingError, originalRequest.photoId);

      await new Promise(resolve => setTimeout(resolve, delay));

      return this.startProcessing(originalRequest, options);
    } catch (error) {
      const processedError = errorService.parseError(error, {
        component: 'ProcessingService',
        action: 'retryProcessing',
      });
      onError?.(processedError);
      throw processedError;
    }
  }

  /**
   * Cancel processing (if supported by backend)
   */
  async cancelProcessing(id: string): Promise<void> {
    try {
      await fetch(`${this.API_BASE_URL}/process/${id}/cancel`, {
        method: 'POST',
      });
    } catch (error) {
      // Cancellation might not be supported, ignore errors
      console.warn('Failed to cancel processing:', error);
    }
  }
}

// Export singleton instance
export const processingService = new ProcessingService();