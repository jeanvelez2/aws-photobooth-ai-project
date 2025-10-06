import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, useAppState } from '../contexts/AppContext';
import ImageProcessor from '../components/ImageProcessor';
import ProcessingError from '../components/ProcessingError';
import { useProcessing } from '../hooks/useProcessing';
import { processingService } from '../services/processingService';
import { errorService } from '../services/errorService';
import type { ProcessingRequest } from '../types';

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { dispatch } = useAppContext();
  const { currentPhoto, selectedTheme, selectedVariant } = useAppState();
  const [processingRequest, setProcessingRequest] = useState<ProcessingRequest | null>(null);
  const processingStartedRef = useRef(false);
  
  // Stable callbacks to prevent infinite loops
  const onComplete = useCallback(() => {
    navigate('/result');
  }, [navigate]);
  
  const onError = useCallback((error: any) => {
    console.error('Processing error:', error);
  }, []);
  
  const {
    isProcessing,
    result,
    error,
    startProcessing,
    retryProcessing,
    clearError,
    reset
  } = useProcessing({
    onComplete,
    onError
  });

  // Set current step when component mounts
  useEffect(() => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'processing' });
  }, [dispatch]);

  // Create processing request when component mounts
  useEffect(() => {
    console.log('ProcessingPage: Creating request with data:', {
      hasCurrentPhoto: !!currentPhoto,
      hasSelectedTheme: !!selectedTheme,
      photoId: currentPhoto?.id,
      themeId: selectedTheme?.id,
      variantId: selectedVariant?.id,
      hasS3Url: !!(currentPhoto as any)?.s3Url,
      hasDataUrl: !!currentPhoto?.dataUrl,
      dataUrlLength: currentPhoto?.dataUrl?.length,
      s3Url: (currentPhoto as any)?.s3Url
    });

    if (!currentPhoto || !selectedTheme) {
      console.log('ProcessingPage: Missing required data, redirecting');
      // Redirect to appropriate page if missing required data
      if (!currentPhoto) {
        navigate('/');
      } else if (!selectedTheme) {
        navigate('/themes');
      }
      return;
    }

    // Create processing request with proper S3 URL
    const originalImageUrl = (currentPhoto as any).s3Url || currentPhoto.dataUrl;
    const request: ProcessingRequest = {
      photoId: currentPhoto.id,
      themeId: selectedTheme.id,
      variantId: selectedVariant?.id,
      outputFormat: 'jpeg',
      originalImageUrl, // Use S3 URL if available
    };

    console.log('ProcessingPage: Created request:', {
      ...request,
      originalImageUrl: originalImageUrl?.substring(0, 100) + '...' // Truncate for logging
    });

    setProcessingRequest(request);
  }, [currentPhoto, selectedTheme, selectedVariant, navigate]);

  // Don't start processing here - let ImageProcessor handle it
  // This prevents duplicate requests that trigger the circuit breaker
  
  // Reset processing started flag when component unmounts or resets
  useEffect(() => {
    return () => {
      processingStartedRef.current = false;
    };
  }, []);

  const handleCancel = () => {
    processingStartedRef.current = false;
    reset();
    navigate('/themes');
  };

  const handleRetry = () => {
    // Reset and reload the page to start fresh
    processingStartedRef.current = false;
    window.location.reload();
  };

  const handleResetConnection = () => {
    // Reset circuit breaker and retry attempts
    processingService.resetCircuitBreaker();
    errorService.resetAllRetryAttempts();
    processingStartedRef.current = false;
    // Reload page to start fresh
    window.location.reload();
  };

  const handleStartOver = () => {
    processingStartedRef.current = false;
    reset();
    dispatch({ type: 'RESET_STATE' });
    navigate('/');
  };

  const handleGoBack = () => {
    processingStartedRef.current = false;
    reset();
    navigate('/themes');
  };

  // Show error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ProcessingError
          error={error}
          onRetry={error.retryable ? handleRetry : undefined}
          onStartOver={handleStartOver}
          onGoBack={handleGoBack}
          onResetConnection={error.type === 'SERVICE_UNAVAILABLE' ? handleResetConnection : undefined}
          context={{
            hasPhoto: !!currentPhoto,
            hasTheme: !!selectedTheme,
            component: 'ProcessingPage',

          }}
        />
      </div>
    );
  }

  // Show processing state
  if (processingRequest) {
    return (
      <ImageProcessor
        request={processingRequest}
        onComplete={onComplete}
        onError={onError}
        onCancel={handleCancel}
      />
    );
  }

  // Loading state while preparing request
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Preparing your image for processing...</p>
      </div>
    </div>
  );
}