import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, useAppState } from '../contexts/AppContext';
import ImageProcessor from '../components/ImageProcessor';
import ProcessingError from '../components/ProcessingError';
import { useProcessing } from '../hooks/useProcessing';
import type { ProcessingRequest } from '../types';

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { dispatch } = useAppContext();
  const { currentPhoto, selectedTheme, selectedVariant } = useAppState();
  const [processingRequest, setProcessingRequest] = useState<ProcessingRequest | null>(null);
  
  const {
    isProcessing,
    result,
    error,
    startProcessing,
    retryProcessing,
    clearError,
    reset
  } = useProcessing({
    onComplete: (result) => {
      // Navigate to result page when processing completes
      navigate('/result');
    },
    onError: (error) => {
      console.error('Processing error:', error);
    }
  });

  // Set current step when component mounts
  useEffect(() => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'processing' });
  }, [dispatch]);

  // Create processing request when component mounts
  useEffect(() => {
    if (!currentPhoto || !selectedTheme) {
      // Redirect to appropriate page if missing required data
      if (!currentPhoto) {
        navigate('/');
      } else if (!selectedTheme) {
        navigate('/themes');
      }
      return;
    }

    // Create processing request
    const request: ProcessingRequest = {
      photoId: currentPhoto.id,
      themeId: selectedTheme.id,
      variantId: selectedVariant?.id,
      outputFormat: 'jpeg',
      originalImageUrl: currentPhoto.dataUrl, // This will be replaced with S3 URL in real implementation
    };

    setProcessingRequest(request);
  }, [currentPhoto, selectedTheme, selectedVariant, navigate]);

  // Start processing when request is ready (with deduplication)
  useEffect(() => {
    if (processingRequest && !isProcessing && !result && !error) {
      // Prevent duplicate requests by checking if we already have this request
      const requestKey = `${processingRequest.photoId}-${processingRequest.themeId}`;
      const lastRequestKey = sessionStorage.getItem('lastProcessingRequest');
      
      if (lastRequestKey !== requestKey) {
        sessionStorage.setItem('lastProcessingRequest', requestKey);
        startProcessing(processingRequest);
      }
    }
  }, [processingRequest, isProcessing, result, error, startProcessing]);

  const handleCancel = () => {
    reset();
    navigate('/themes');
  };

  const handleRetry = () => {
    clearError();
    if (processingRequest) {
      startProcessing(processingRequest);
    }
  };

  const handleStartOver = () => {
    reset();
    dispatch({ type: 'RESET_STATE' });
    navigate('/');
  };

  const handleGoBack = () => {
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
        />
      </div>
    );
  }

  // Show processing state
  if (processingRequest) {
    return (
      <ImageProcessor
        request={processingRequest}
        onComplete={(result) => {
          // This is handled by the useProcessing hook
        }}
        onError={(error) => {
          // This is handled by the useProcessing hook
        }}
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