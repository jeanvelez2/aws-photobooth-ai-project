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
  private readonly MAX_PROCESSING_TIME = 30000; // 30 seconds

  constructor(apiBaseUrl?: string) {
    this.API_BASE_URL = apiBaseUrl || import.meta.env.VITE_API_URL || '/api';
  }

  /**
   * Start image processing with error handling and fallback
   */
  async startProcessing(request: ProcessingRequest, options: ProcessingOptions = {}): Promise<ProcessingResult> {
    const { enableFallback = false, onError } = options; // Disable fallback to prevent loops

    // Immediately throw error to stop the loop
    throw errorService.createError(
      ProcessingErrorType.SERVICE_UNAVAILABLE,
      new Error('Service temporarily disabled to prevent browser overload'),
      {
        component: 'ProcessingService',
        action: 'startProcessing',
      }
    );

    try {
      return await gracefulDegradationService.executeWithFallback(
        'processing',
        async () => {
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
            
            // Create appropriate error based on status code
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
          
          // Validate response has required fields
          if (!result.id) {
            throw new Error('Invalid response: missing job ID');
          }
          
          return result;
        },
        enableFallback ? async () => {
          // Fallback to queuing for later processing
          const fallbacks = gracefulDegradationService.getProcessingFallbacks();
          const queueResult = await fallbacks.queueForLater(request);
          
          // Return a mock processing result for queued items
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
        } : undefined
      );
    } catch (error) {
      // Handle network errors specifically
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = errorService.createError(
          ProcessingErrorType.SERVICE_UNAVAILABLE,
          new Error(`Backend service is unavailable. Please try again later. (${error.message})`),
          {
            component: 'ProcessingService',
            action: 'startProcessing',
          }
        );
        onError?.(networkError);
        throw networkError;
      }
      
      const processedError = errorService.parseError(error, {
        component: 'ProcessingService',
        action: 'startProcessing',
      });
      onError?.(processedError);
      throw processedError;
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
      
      const processedError = errorService.parseError(error, {
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
            const error = errorService.createError(ProcessingErrorType.PROCESSING_TIMEOUT, new Error('Processing timeout'), {
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