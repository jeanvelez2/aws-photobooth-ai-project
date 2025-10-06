/**
 * ImageProcessor Component
 * Manages the complete image processing workflow including status polling,
 * progress indicators, and error handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { processingService, ProcessingError } from '../services/processingService';
import { errorService } from '../services/errorService';
import type { ProcessingRequest, ProcessingResult } from '../types';

interface ImageProcessorProps {
  request: ProcessingRequest;
  onComplete: (result: ProcessingResult) => void;
  onError: (error: ProcessingError) => void;
  onCancel?: () => void;
}

interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  active: boolean;
}

export default function ImageProcessor({ 
  request, 
  onComplete, 
  onError, 
  onCancel 
}: ImageProcessorProps) {
  const { dispatch } = useAppContext();
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Processing steps for UI display
  const processingSteps: ProcessingStep[] = [
    {
      id: 'upload',
      label: 'Image Upload',
      description: 'Uploading your photo securely',
      completed: true,
      active: false
    },
    {
      id: 'detection',
      label: 'Face Detection',
      description: 'Analyzing facial features and landmarks',
      completed: false,
      active: currentStep === 1
    },
    {
      id: 'alignment',
      label: 'Face Alignment',
      description: 'Aligning face with theme template',
      completed: false,
      active: currentStep === 2
    },
    {
      id: 'blending',
      label: 'Image Blending',
      description: 'Seamlessly integrating with background',
      completed: false,
      active: currentStep === 3
    },
    {
      id: 'finalization',
      label: 'Finalization',
      description: 'Generating high-resolution output',
      completed: false,
      active: currentStep === 4
    }
  ];

  // Update processing steps based on progress
  const updateSteps = useCallback((progressValue: number) => {
    const stepIndex = Math.floor((progressValue / 100) * (processingSteps.length - 1));
    setCurrentStep(Math.min(stepIndex + 1, processingSteps.length - 1));
  }, []);

  // Start processing
  const startProcessing = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Create abort controller for cancellation
      const controller = new AbortController();
      setAbortController(controller);

      // Start processing
      const initialResult = await processingService.startProcessing(request);
      setProcessingResult(initialResult);

      // Update app context
      dispatch({ 
        type: 'SET_PROCESSING_STATUS', 
        payload: initialResult 
      });

      // Start polling for status updates
      const finalResult = await processingService.pollProcessingStatus(
        initialResult.id,
        {
          onProgress: (progressValue) => {
            setProgress(progressValue);
            updateSteps(progressValue);
          },
          onStatusChange: (status) => {
            setProcessingResult(prev => prev ? { ...prev, status } : null);
          },
          signal: controller.signal
        }
      );

      // Processing completed
      setProgress(100);
      setCurrentStep(processingSteps.length);
      setProcessingResult(finalResult);
      
      dispatch({ 
        type: 'SET_PROCESSING_STATUS', 
        payload: finalResult 
      });

      if (finalResult.status === 'completed') {
        onComplete(finalResult);
      } else if (finalResult.status === 'failed') {
        const error = errorService.parseError(finalResult.error, {
          component: 'ImageProcessor',
          action: 'processImage',
        });
        onError(error);
      }

    } catch (error) {
      console.error('Processing failed:', error);
      
      if (error instanceof Error && error.message === 'Processing cancelled') {
        return; // Don't show error for user cancellation
      }

      const processingError = errorService.parseError(error, {
        component: 'ImageProcessor',
        action: 'processImage',
      });
      onError(processingError);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      setAbortController(null);
    }
  }, [request, onComplete, onError, dispatch, updateSteps]);

  // Retry processing
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    setProgress(0);
    setCurrentStep(0);
    
    try {
      await startProcessing();
    } finally {
      setIsRetrying(false);
    }
  }, [startProcessing]);

  // Cancel processing
  const handleCancel = useCallback(async () => {
    if (abortController) {
      abortController.abort();
    }
    
    if (processingResult?.id) {
      await processingService.cancelProcessing(processingResult.id);
    }
    
    onCancel?.();
  }, [abortController, processingResult?.id, onCancel]);

  // Start processing on mount (only once)
  useEffect(() => {
    let mounted = true;
    const start = async () => {
      if (mounted) {
        await startProcessing();
      }
    };
    start();
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array to run only once

  // Calculate estimated time remaining
  const getEstimatedTimeRemaining = () => {
    if (progress === 0) return '15 seconds';
    
    const elapsed = Date.now() - (processingResult?.createdAt?.getTime() || Date.now());
    const estimatedTotal = (elapsed / progress) * 100;
    const remaining = Math.max(0, estimatedTotal - elapsed);
    
    return `${Math.ceil(remaining / 1000)} seconds`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Processing Your Image
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Our AI is working its magic to seamlessly integrate your face into the selected theme. 
          This usually takes 8-15 seconds.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Processing Progress
            </span>
            <span className="text-sm text-gray-500">
              {progress}% • Est. {getEstimatedTimeRemaining()} remaining
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Processing animation */}
        <div className="text-center mb-8">
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-4 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            AI Processing in Progress
          </h3>
          <p className="text-gray-600 mb-4">
            {processingSteps[currentStep]?.description || 'Processing your image...'}
          </p>
        </div>

        {/* Processing steps */}
        <div className="space-y-3 max-w-md mx-auto mb-8">
          {processingSteps.map((step, index) => (
            <div key={step.id} className="flex items-center text-sm">
              <div className={`w-4 h-4 rounded-full mr-3 flex items-center justify-center ${
                index < currentStep 
                  ? 'bg-green-500' 
                  : index === currentStep 
                    ? 'bg-purple-500 animate-pulse' 
                    : 'bg-gray-300'
              }`}>
                {index < currentStep ? (
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                    <path d="M6.564.75l-3.59 3.612-1.538-1.55L0 4.26l2.974 2.99L8 2.193z"/>
                  </svg>
                ) : index === currentStep ? (
                  <div className="w-full h-full bg-purple-600 rounded-full animate-ping"></div>
                ) : null}
              </div>
              <span className={
                index < currentStep 
                  ? 'text-green-700' 
                  : index === currentStep 
                    ? 'text-purple-700 font-medium' 
                    : 'text-gray-500'
              }>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Retry section (shown if retrying) */}
        {isRetrying && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-yellow-800 font-medium">
                Retrying processing (Attempt {retryCount + 1})
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="text-center">
          <button
            onClick={handleCancel}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={!abortController}
          >
            Cancel Processing
          </button>
        </div>
      </div>

      {/* Processing tips */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">While you wait:</h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            Our AI analyzes 27+ facial landmarks for precise alignment
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            Advanced blending ensures seamless integration with the theme
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            Color correction matches lighting between your face and background
          </li>
        </ul>
      </div>
    </div>
  );
}