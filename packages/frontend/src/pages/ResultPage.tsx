import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, useAppState } from '../contexts/AppContext';
import ImagePreview from '../components/ImagePreview';

export default function ResultPage() {
  const navigate = useNavigate();
  const { dispatch } = useAppContext();
  const { processingStatus, selectedTheme } = useAppState();

  useEffect(() => {
    // Set current step when component mounts
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'result' });
  }, [dispatch]);

  const handleDownload = (customFilename?: string) => {
    console.log('Downloaded image:', customFilename);
    // Track download analytics if needed
  };

  const handleStartOver = () => {
    // Reset state and go back to capture
    dispatch({ type: 'RESET_STATE' });
    navigate('/');
  };

  const handleTryAnotherTheme = () => {
    // Keep photo but go back to theme selection
    dispatch({ type: 'SET_PROCESSING_STATUS', payload: null });
    navigate('/themes');
  };

  // Redirect to processing if no result available
  if (!processingStatus || processingStatus.status !== 'completed') {
    useEffect(() => {
      navigate('/process');
    }, [navigate]);
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Your AI Photobooth Result
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Amazing! Your face has been seamlessly integrated into the {selectedTheme?.name || 'selected'} theme. 
          Processing completed in {processingStatus.processingTime ? Math.round(processingStatus.processingTime / 1000) : 'N/A'} seconds.
        </p>
      </div>

      {/* Image preview with download functionality */}
      <div className="mb-8">
        <ImagePreview
          result={processingStatus}
          theme={selectedTheme}
          onDownload={handleDownload}
          onRetry={handleTryAnotherTheme}
          onStartOver={handleStartOver}
        />
      </div>

      {/* Success message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Processing completed successfully!
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p>
                Your image has been processed with high-quality AI face blending. 
                The result maintains natural lighting and seamless integration with the theme background.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}