/**
 * useProcessing Hook
 * Manages image processing workflow, status polling, and error handling
 */

import { useState, useCallback, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { processingService, ProcessingError } from '../services/processingService';
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

  // Start processing
  const startProcessing = useCallback(async (request: ProcessingRequest) => {
    if (isProcessing) {
      console.warn('Processing already in progress');
      return;
    }

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
            options.onProgress?.(progressValue);
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
        options.onComplete?.(finalResult);
      } else if (finalResult.status === 'failed') {
        const processingError = processingService.parseProcessingError(finalResult.error);
        setError(processingError);
        options.onError?.(processingError);
      }

    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        return; // Don't show error for user cancellation
      }

      console.error('Processing failed:', err);
      const processingError = processingService.parseProcessingError(err);
      setError(processingError);
      dispatch({ type: 'SET_UI_ERROR', payload: processingError.userMessage });
      options.onError?.(processingError);
    } finally {
      setIsProcessing(false);
      dispatch({ type: 'SET_LOADING', payload: false });
      abortControllerRef.current = null;
    }
  }, [isProcessing, dispatch, options]);

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