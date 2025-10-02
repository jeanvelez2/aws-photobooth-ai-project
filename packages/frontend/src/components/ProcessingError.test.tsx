/**
 * ProcessingError Component Tests
 * Tests for enhanced error display and recovery actions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProcessingErrorType } from '@photobooth/shared';
import ProcessingError from './ProcessingError';
import { errorService } from '../services/errorService';
import { document } from 'postcss';

// Mock error service
vi.mock('../services/errorService', () => ({
  errorService: {
    getRecoveryActions: vi.fn(),
    canRetry: vi.fn(),
    recordRetryAttempt: vi.fn(),
    resetRetryAttempts: vi.fn(),
  },
}));

describe('ProcessingError Component', () => {
  const mockError = {
    type: ProcessingErrorType.NO_FACE_DETECTED,
    message: 'No face detected in the image',
    userMessage: 'We couldn\'t detect a face in your photo. Please try again with a clearer image.',
    retryable: true,
    severity: 'medium' as const,
    suggestions: [
      'Make sure your face is clearly visible',
      'Ensure good lighting',
      'Face the camera directly',
    ],
    timestamp: new Date(),
    requestId: 'test-request-id',
  };

  const mockRecoveryActions = [
    { type: 'retry' as const, label: 'Try Again', primary: true },
    { type: 'retakePhoto' as const, label: 'Retake Photo' },
    { type: 'startOver' as const, label: 'Start Over' },
  ];

  const defaultProps = {
    error: mockError,
    onRetry: vi.fn(),
    onStartOver: vi.fn(),
    onGoBack: vi.fn(),
    onRetakePhoto: vi.fn(),
    onSelectTheme: vi.fn(),
    onRefresh: vi.fn(),
    onContact: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(errorService.getRecoveryActions).mockReturnValue(mockRecoveryActions);
    vi.mocked(errorService.canRetry).mockReturnValue(true);
  });

  it('should render error message and suggestions', () => {
    render(<ProcessingError {...defaultProps} />);
    
    expect(screen.getByText('Processing Failed')).toBeInTheDocument();
    expect(screen.getByText(mockError.userMessage)).toBeInTheDocument();
    expect(screen.getByText('Here\'s what you can try:')).toBeInTheDocument();
    expect(screen.getByText('Make sure your face is clearly visible')).toBeInTheDocument();
  });

  it('should display recovery actions as buttons', () => {
    render(<ProcessingError {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retake Photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Over' })).toBeInTheDocument();
  });

  it('should call appropriate handlers when recovery actions are clicked', () => {
    render(<ProcessingError {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(defaultProps.onRetry).toHaveBeenCalled();
    expect(errorService.recordRetryAttempt).toHaveBeenCalledWith(mockError);
    
    fireEvent.click(screen.getByRole('button', { name: 'Retake Photo' }));
    expect(defaultProps.onRetakePhoto).toHaveBeenCalled();
    
    fireEvent.click(screen.getByRole('button', { name: 'Start Over' }));
    expect(defaultProps.onStartOver).toHaveBeenCalled();
    expect(errorService.resetRetryAttempts).toHaveBeenCalledWith('test-request-id');
  });

  it('should disable retry button when retries are exhausted', () => {
    vi.mocked(errorService.canRetry).mockReturnValue(false);
    
    render(<ProcessingError {...defaultProps} />);
    
    const retryButton = screen.getByRole('button', { name: 'Try Again' });
    expect(retryButton).toBeDisabled();
  });

  it('should show different colors based on error severity', () => {
    const criticalError = { ...mockError, severity: 'critical' as const };
    render(<ProcessingError {...defaultProps} error={criticalError} />);
    
    // Look for the main container div with the background color
    const container = screen.getByText('Processing Failed').closest('div')?.parentElement;
    expect(container).toHaveClass('bg-red-50');
  });

  it('should display technical details in collapsible section', () => {
    render(<ProcessingError {...defaultProps} />);
    
    const detailsElement = screen.getByText('Technical Details');
    expect(detailsElement).toBeInTheDocument();
    
    fireEvent.click(detailsElement);
    expect(screen.getByText('Error Type:')).toBeInTheDocument();
    expect(screen.getByText(mockError.type)).toBeInTheDocument();
    expect(screen.getByText('Severity:')).toBeInTheDocument();
    expect(screen.getByText(mockError.severity)).toBeInTheDocument();
  });

  it('should show retry exhausted message when applicable', () => {
    vi.mocked(errorService.canRetry).mockReturnValue(false);
    
    render(<ProcessingError {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Technical Details'));
    expect(screen.getByText('Maximum retry attempts reached')).toBeInTheDocument();
  });

  it('should handle different error types with appropriate icons', () => {
    const networkError = {
      ...mockError,
      type: ProcessingErrorType.NETWORK_ERROR,
      severity: 'high' as const,
    };
    
    render(<ProcessingError {...defaultProps} error={networkError} />);
    
    // Should render network-specific icon (check for SVG with network path)
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should pass context to error service for recovery actions', () => {
    const context = { hasPhoto: true, hasTheme: true, component: 'TestComponent' };
    
    render(<ProcessingError {...defaultProps} context={context} />);
    
    expect(errorService.getRecoveryActions).toHaveBeenCalledWith(mockError, context);
  });

  it('should handle theme not found errors with specific actions', () => {
    const themeError = {
      ...mockError,
      type: ProcessingErrorType.THEME_NOT_FOUND,
      userMessage: 'The selected theme is not available.',
    };
    
    const themeRecoveryActions = [
      { type: 'selectTheme' as const, label: 'Choose Different Theme', primary: true },
      { type: 'refresh' as const, label: 'Refresh Page' },
    ];
    
    vi.mocked(errorService.getRecoveryActions).mockReturnValue(themeRecoveryActions);
    
    render(<ProcessingError {...defaultProps} error={themeError} />);
    
    expect(screen.getByRole('button', { name: 'Choose Different Theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
  });

  it('should handle refresh action correctly', () => {
    const refreshAction = { type: 'refresh' as const, label: 'Refresh Page' };
    vi.mocked(errorService.getRecoveryActions).mockReturnValue([refreshAction]);
    
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });
    
    render(<ProcessingError {...defaultProps} onRefresh={undefined} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Page' }));
    expect(mockReload).toHaveBeenCalled();
  });

  it('should show help section with additional guidance', () => {
    render(<ProcessingError {...defaultProps} />);
    
    expect(screen.getByText('Need more help?')).toBeInTheDocument();
    expect(screen.getByText(/For best results, use a clear, well-lit photo/)).toBeInTheDocument();
  });

  it('should handle contact action', () => {
    const contactAction = { type: 'contact' as const, label: 'Contact Support' };
    vi.mocked(errorService.getRecoveryActions).mockReturnValue([contactAction]);
    
    render(<ProcessingError {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Contact Support' }));
    expect(defaultProps.onContact).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ProcessingError {...defaultProps} className="custom-error-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-error-class');
  });
});