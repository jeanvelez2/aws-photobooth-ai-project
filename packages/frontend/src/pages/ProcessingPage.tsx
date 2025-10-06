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

  // Start processing when request is ready (with deduplication)
  useEffect(() => {
    console.log('ProcessingPage: Processing effect triggered:', {
      hasProcessingRequest: !!processingRequest,
      isProcessing,
      hasResult: !!result,
      hasError: !!error,
      requestData: processingRequest ? {
        photoId: processingRequest.photoId,
        themeId: processingRequest.themeId,
        variantId: processingRequest.variantId,
        originalImageUrlType: processingRequest.originalImageUrl?.startsWith('data:') ? 'dataUrl' : 'httpUrl',
        originalImageUrlLength: processingRequest.originalImageUrl?.length
      } : null
    });

    if (processingRequest && !isProcessing && !result && !error) {
      // Prevent duplicate requests by checking if we already have this request
      const requestKey = `${processingRequest.photoId}-${processingRequest.themeId}`;
      const lastRequestKey = sessionStorage.getItem('lastProcessingRequest');
      
      console.log('ProcessingPage: Checking deduplication:', {
        requestKey,
        lastRequestKey,
        shouldStart: lastRequestKey !== requestKey
      });
      
      if (lastRequestKey !== requestKey) {
        console.log('ProcessingPage: Starting processing with request:', {
          ...processingRequest,
          originalImageUrl: processingRequest.originalImageUrl?.substring(0, 50) + '...'
        });
        sessionStorage.setItem('lastProcessingRequest', requestKey);
        startProcessing(processingRequest);
      } else {
        console.log('ProcessingPage: Skipping duplicate request');
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