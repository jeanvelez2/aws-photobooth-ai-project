/**
 * ProcessingError Component
 * Displays user-friendly error messages with retry options and suggestions
 */

import React, { useCallback } from 'react';
import { ProcessingError as ProcessingErrorType, RecoveryAction } from '@photobooth/shared';
import { errorService } from '../services/errorService';

interface ProcessingErrorProps {
  error: ProcessingErrorType;
  onRetry?: () => void;
  onStartOver?: () => void;
  onGoBack?: () => void;
  onRetakePhoto?: () => void;
  onSelectTheme?: () => void;
  onRefresh?: () => void;
  onContact?: () => void;
  onResetConnection?: () => void;
  context?: {
    hasPhoto?: boolean;
    hasTheme?: boolean;
    component?: string;
  };
  className?: string;
}

export default function ProcessingError({ 
  error, 
  onRetry, 
  onStartOver, 
  onGoBack,
  onRetakePhoto,
  onSelectTheme,
  onRefresh,
  onContact,
  onResetConnection,
  context,
  className = '' 
}: ProcessingErrorProps) {
  
  // Get recovery actions from error service
  const recoveryActions = errorService.getRecoveryActions(error, context);
  
  // Handle recovery action clicks
  const handleRecoveryAction = useCallback((action: RecoveryAction) => {
    switch (action.type) {
      case 'retry':
        if (errorService.canRetry(error)) {
          errorService.recordRetryAttempt(error);
          onRetry?.();
        }
        break;
      case 'startOver':
        errorService.resetRetryAttempts(error.requestId || 'default');
        onStartOver?.();
        break;
      case 'goBack':
        onGoBack?.();
        break;
      case 'retakePhoto':
        onRetakePhoto?.();
        break;
      case 'selectTheme':
        onSelectTheme?.();
        break;
      case 'refresh':
        onRefresh ? onRefresh() : window.location.reload();
        break;
      case 'contact':
        onContact?.();
        break;
      case 'resetConnection':
        onResetConnection?.();
        break;
    }
  }, [error, onRetry, onStartOver, onGoBack, onRetakePhoto, onSelectTheme, onRefresh, onContact]);
  
  // Get error icon based on error severity and type
  const getErrorIcon = () => {
    const iconClass = `w-16 h-16`;
    
    // Color based on severity
    const colorMap = {
      low: 'text-blue-500',
      medium: 'text-yellow-500', 
      high: 'text-orange-500',
      critical: 'text-red-500'
    } as const;
    const colorClass = colorMap[error.severity as keyof typeof colorMap] || 'text-gray-500';

    // Icon based on error type
    switch (error.type) {
      case 'NO_FACE_DETECTED':
      case 'MULTIPLE_FACES':
      case 'FACE_TOO_SMALL':
      case 'EXTREME_POSE':
        return (
          <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'POOR_IMAGE_QUALITY':
      case 'INVALID_IMAGE_FORMAT':
      case 'IMAGE_TOO_LARGE':
        return (
          <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'NETWORK_ERROR':
      case 'UPLOAD_FAILED':
        return (
          <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        );
      case 'PROCESSING_TIMEOUT':
      case 'SERVICE_UNAVAILABLE':
        return (
          <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'RATE_LIMITED':
        return (
          <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'THEME_NOT_FOUND':
        return (
          <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
          </svg>
        );
      default:
        return (
          <svg className={`${iconClass} ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  // Get error color theme based on severity
  const getErrorColorTheme = () => {
    switch (error.severity) {
      case 'low':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          button: 'bg-blue-600 hover:bg-blue-700'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          button: 'bg-yellow-600 hover:bg-yellow-700'
        };
      case 'high':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-800',
          button: 'bg-orange-600 hover:bg-orange-700'
        };
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          button: 'bg-red-600 hover:bg-red-700'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          button: 'bg-gray-600 hover:bg-gray-700'
        };
    }
  };

  const colorTheme = getErrorColorTheme();

  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      <div className={`${colorTheme.bg} ${colorTheme.border} border rounded-lg p-8`}>
        {/* Error icon and title */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            {getErrorIcon()}
          </div>
          <h2 className={`text-2xl font-bold ${colorTheme.text} mb-2`}>
            Processing Failed
          </h2>
          <p className={`text-lg ${colorTheme.text}`}>
            {error.userMessage}
          </p>
        </div>

        {/* Error suggestions */}
        {error.suggestions && error.suggestions.length > 0 && (
          <div className="mb-6">
            <h3 className={`text-lg font-semibold ${colorTheme.text} mb-3`}>
              Here's what you can try:
            </h3>
            <ul className={`space-y-2 ${colorTheme.text}`}>
              {error.suggestions.map((suggestion: string, index: number) => (
                <li key={index} className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {recoveryActions.map((action, index) => {
            const isPrimary = action.primary;
            const buttonClass = isPrimary 
              ? `px-6 py-3 ${colorTheme.button} text-white rounded-lg transition-colors font-medium flex items-center justify-center`
              : "px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center";
            
            // Get appropriate icon for action type
            const getActionIcon = () => {
              switch (action.type) {
                case 'retry':
                  return (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  );
                case 'goBack':
                case 'selectTheme':
                  return (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  );
                case 'retakePhoto':
                  return (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  );
                case 'refresh':
                  return (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  );
                case 'contact':
                  return (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  );
                case 'resetConnection':
                  return (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                  );
                default:
                  return null;
              }
            };

            return (
              <button
                key={index}
                onClick={() => handleRecoveryAction(action)}
                className={buttonClass}
                title={action.description}
                disabled={action.type === 'retry' && !errorService.canRetry(error)}
              >
                {getActionIcon()}
                {action.label}
              </button>
            );
          })}
        </div>

        {/* Technical details (collapsible) */}
        <details className="mt-6">
          <summary className={`cursor-pointer text-sm ${colorTheme.text} opacity-75 hover:opacity-100`}>
            Technical Details
          </summary>
          <div className={`mt-2 p-3 bg-white bg-opacity-50 rounded text-sm ${colorTheme.text} font-mono`}>
            <div><strong>Error Type:</strong> {error.type}</div>
            <div><strong>Message:</strong> {error.message}</div>
            <div><strong>Severity:</strong> {error.severity}</div>
            <div><strong>Retryable:</strong> {error.retryable ? 'Yes' : 'No'}</div>
            {error.requestId && <div><strong>Request ID:</strong> {error.requestId}</div>}
            {error.timestamp && <div><strong>Timestamp:</strong> {error.timestamp.toISOString()}</div>}
            {!errorService.canRetry(error) && error.retryable && (
              <div className="text-orange-600 mt-2">
                <strong>Note:</strong> Maximum retry attempts reached
              </div>
            )}
          </div>
        </details>
      </div>

      {/* Additional help section */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-800 mb-1">
              Need more help?
            </h4>
            <p className="text-sm text-blue-700">
              For best results, use a clear, well-lit photo with your face clearly visible and facing the camera directly. 
              Make sure you're the only person in the frame.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}