/**
 * useProcessing Hook
 * Manages image processing workflow, status polling, and error handling
 */

import { useState, useCallback, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { processingService, ProcessingError } from '../services/processingService';
import { errorService } from '../services/errorService';
import type { ProcessingRequest, ProcessingResult } from '../types';

interface UseProcessingOptions {
  onComplete?: (result: ProcessingResult) => void;
  onError?: (error: ProcessingError) => void;
  onProgress?: (progress: number) => void;
}

interface UseProcessingReturn {
  // State
  isProcessing: boolean;
  progress: number;
  result: ProcessingResult | null;
  error: ProcessingError | null;
  
  // Actions
  startProcessing: (request: ProcessingRequest) => Promise<void>;
  retryProcessing: () => Promise<void>;
  cancelProcessing: () => void;
  clearError: () => void;
  reset: () => void;
}

export function useProcessing(options: UseProcessingOptions = {}): UseProcessingReturn {
  const { dispatch } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  
  // Store the last request for retry functionality
  const lastRequestRef = useRef<ProcessingRequest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const lastRequestTimeRef = useRef(0);
  const optionsRef = useRef(options);
  const MAX_RETRIES = 3;
  const MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests
  
  // Update options ref when options change
  optionsRef.current = options;

  // Start processing
  const startProcessing = useCallback(async (request: ProcessingRequest) => {
    if (isProcessing) {
      console.warn('Processing already in progress');
      return;
    }

    // Check retry limit
    if (retryCountRef.current >= MAX_RETRIES) {
      const maxRetriesError = errorService.createError(
        'INTERNAL_ERROR' as any,
        new Error('Maximum retry attempts reached'),
        { component: 'useProcessing', action: 'startProcessing' }
      );
      setError(maxRetriesError);
      return;
    }

    // Throttle requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`Throttling request, waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    lastRequestTimeRef.current = Date.now();

    // Store request for potential retry
    lastRequestRef.current = request;
    
    // Reset state
    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    setError(null);
    
    // Update app context
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_UI_ERROR', payload: null });

    try {
      // Create abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Start processing
      const initialResult = await processingService.startProcessing(request);
      
      if (abortController.signal.aborted) {
        return; // Processing was cancelled
      }

      setResult(initialResult);
      dispatch({ type: 'SET_PROCESSING_STATUS', payload: initialResult });

      // Poll for completion
      const finalResult = await processingService.pollProcessingStatus(
        initialResult.id,
        {
          onProgress: (progressValue) => {
            setProgress(progressValue);
            optionsRef.current.onProgress?.(progressValue);
          },
          onStatusChange: (status) => {
            setResult(prev => prev ? { ...prev, status } : null);
          },
          signal: abortController.signal
        }
      );

      if (abortController.signal.aborted) {
        return; // Processing was cancelled
      }

      // Update final result
      setResult(finalResult);
      setProgress(100);
      dispatch({ type: 'SET_PROCESSING_STATUS', payload: finalResult });

      if (finalResult.status === 'completed') {
        optionsRef.current.onComplete?.(finalResult);
      } else if (finalResult.status === 'failed') {
        const processingError = errorService.parseError(finalResult.error, {
          component: 'useProcessing',
          action: 'processImage',
        });
        setError(processingError);
        optionsRef.current.onError?.(processingError);
      }

    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        return; // Don't show error for user cancellation
      }

      retryCountRef.current++;
      console.error(`Processing failed (attempt ${retryCountRef.current}):`, err);
      
      const processingError = errorService.parseError(err, {
        component: 'useProcessing',
        action: 'processImage',
      });
      
      // Don't retry validation errors (4xx) or network resource errors
      const isNetworkResourceError = err instanceof TypeError && err.message.includes('ERR_INSUFFICIENT_RESOURCES');
      const isValidationError = err instanceof Error && err.message.includes('400');
      
      // Only set error if we've exceeded max retries, it's not retryable, or it's a client/network error
      if (retryCountRef.current >= MAX_RETRIES || !processingError.retryable || isNetworkResourceError || isValidationError) {
        setError(processingError);
        dispatch({ type: 'SET_UI_ERROR', payload: processingError.userMessage });
        optionsRef.current.onError?.(processingError);
      } else {
        // Auto-retry with exponential backoff for server errors only
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000);
        console.log(`Auto-retrying in ${backoffDelay}ms...`);
        setTimeout(() => {
          if (lastRequestRef.current) {
            startProcessing(lastRequestRef.current);
          }
        }, backoffDelay);
        return;
      }
    } finally {
      setIsProcessing(false);
      dispatch({ type: 'SET_LOADING', payload: false });
      abortControllerRef.current = null;
    }
  }, [isProcessing, dispatch]);

  // Retry processing with the same request
  const retryProcessing = useCallback(async () => {
    if (!lastRequestRef.current) {
      console.warn('No previous request to retry');
      return;
    }

    await startProcessing(lastRequestRef.current);
  }, [startProcessing]);

  // Cancel processing
  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (result?.id) {
      processingService.cancelProcessing(result.id).catch(err => {
        console.warn('Failed to cancel processing on server:', err);
      });
    }

    setIsProcessing(false);
    setProgress(0);
    dispatch({ type: 'SET_LOADING', payload: false });
  }, [result?.id, dispatch]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
    dispatch({ type: 'SET_UI_ERROR', payload: null });
  }, [dispatch]);

  // Reset all state
  const reset = useCallback(() => {
    cancelProcessing();
    setResult(null);
    setError(null);
    setProgress(0);
    lastRequestRef.current = null;
    retryCountRef.current = 0;
    lastRequestTimeRef.current = 0;
    sessionStorage.removeItem('lastProcessingRequest');
    dispatch({ type: 'SET_PROCESSING_STATUS', payload: null });
  }, [cancelProcessing, dispatch]);

  return {
    // State
    isProcessing,
    progress,
    result,
    error,
    
    // Actions
    startProcessing,
    retryProcessing,
    cancelProcessing,
    clearError,
    reset
  };
}