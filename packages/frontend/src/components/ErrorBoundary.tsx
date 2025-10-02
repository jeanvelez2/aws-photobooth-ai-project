import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ProcessingErrorType } from '@photobooth/shared';
import { errorService } from '../services/errorService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'feature';
  context?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      errorId: `boundary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with error service
    const processedError = errorService.createError(
      ProcessingErrorType.INTERNAL_ERROR,
      error,
      {
        component: this.props.context || 'ErrorBoundary',
        action: 'componentDidCatch',
        url: window.location.href,
        userAgent: navigator.userAgent,
      }
    );

    // Store error info for display
    this.setState({ errorInfo });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to console for development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Send to external error tracking service if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorBoundary: true,
          level: this.props.level || 'component',
          context: this.props.context,
        },
      });
    }
  }

  private handleReset = () => {
    // Reset retry attempts for this error
    if (this.state.errorId) {
      errorService.resetRetryAttempts(this.state.errorId);
    }
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorId: undefined });
  };

  private handleReportError = () => {
    if (this.state.error && this.state.errorId) {
      const errorReport = {
        errorId: this.state.errorId,
        message: this.state.error.message,
        stack: this.state.error.stack,
        componentStack: this.state.errorInfo?.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        context: this.props.context,
        level: this.props.level,
      };

      // Copy to clipboard for easy reporting
      navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2)).then(() => {
        alert('Error details copied to clipboard. Please share this with support.');
      }).catch(() => {
        // Fallback: show error details in a modal or new window
        const errorWindow = window.open('', '_blank');
        if (errorWindow) {
          errorWindow.document.write(`
            <html>
              <head><title>Error Report</title></head>
              <body>
                <h1>Error Report</h1>
                <pre>${JSON.stringify(errorReport, null, 2)}</pre>
                <p>Please copy this information and share it with support.</p>
              </body>
            </html>
          `);
        }
      });
    }
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h2>
            
            <p className="text-gray-600 mb-6">
              We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
            </p>
            
            {this.state.error && (
              <details className="text-left mb-4 p-3 bg-gray-50 rounded border text-sm">
                <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                  Error Details
                </summary>
                <div className="space-y-2">
                  <div>
                    <strong>Message:</strong>
                    <code className="text-red-600 break-all block mt-1">
                      {this.state.error.message}
                    </code>
                  </div>
                  {this.state.errorId && (
                    <div>
                      <strong>Error ID:</strong>
                      <code className="text-gray-600 block mt-1">{this.state.errorId}</code>
                    </div>
                  )}
                  <div>
                    <strong>Context:</strong>
                    <code className="text-gray-600 block mt-1">
                      {this.props.context || 'Unknown'} ({this.props.level || 'component'})
                    </code>
                  </div>
                  {process.env.NODE_ENV === 'development' && this.state.error.stack && (
                    <div>
                      <strong>Stack Trace:</strong>
                      <pre className="text-xs text-gray-500 mt-1 overflow-auto max-h-32">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Page
              </button>

              <button
                onClick={this.handleReportError}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Report Error
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}