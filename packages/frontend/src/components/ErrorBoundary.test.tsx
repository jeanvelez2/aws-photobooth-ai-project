/**
 * ErrorBoundary Component Tests
 * Tests for enhanced error boundary with logging and monitoring
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';
import { errorService } from '../services/errorService';

// Mock error service
vi.mock('../services/errorService', () => ({
  errorService: {
    createError: vi.fn().mockReturnValue({
      type: 'INTERNAL_ERROR',
      message: 'Test error',
      severity: 'high',
    }),
    resetRetryAttempts: vi.fn(),
  },
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock window.open
global.open = vi.fn();

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary Component', () => {
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render error UI when an error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument();
  });

  it('should call onError callback when provided', () => {
    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(mockOnError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should create error with error service', () => {
    render(
      <ErrorBoundary context="TestComponent">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(errorService.createError).toHaveBeenCalledWith(
      'INTERNAL_ERROR',
      expect.any(Error),
      expect.objectContaining({
        component: 'TestComponent',
        action: 'componentDidCatch',
      })
    );
  });

  it('should display error details in collapsible section', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const detailsElement = screen.getByText('Error Details');
    expect(detailsElement).toBeInTheDocument();

    fireEvent.click(detailsElement);
    expect(screen.getByText('Message:')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('Error ID:')).toBeInTheDocument();
  });

  it('should show stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Error Details'));
    expect(screen.getByText('Stack Trace:')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should reset error state when Try Again is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    // The error boundary should reset its state
    expect(errorService.resetRetryAttempts).toHaveBeenCalled();

    // Rerender with non-throwing component
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should reload page when Refresh Page is clicked', () => {
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Page' }));
    expect(mockReload).toHaveBeenCalled();
  });

  it('should copy error details to clipboard when Report Error is clicked', async () => {
    // Mock the clipboard writeText to return a resolved promise
    vi.mocked(navigator.clipboard.writeText).mockResolvedValueOnce(undefined);
    
    render(
      <ErrorBoundary context="TestComponent" level="component">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Report Error' }));

    // Wait for the async operation
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"message": "Test error message"')
    );
  });

  it('should open new window if clipboard fails', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Clipboard failed'));
    const mockWindow = { document: { write: vi.fn() } };
    vi.mocked(global.open).mockReturnValueOnce(mockWindow as any);

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Report Error' }));

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.open).toHaveBeenCalledWith('', '_blank');
    expect(mockWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining('<h1>Error Report</h1>')
    );
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should include context and level in error report', () => {
    render(
      <ErrorBoundary context="TestComponent" level="page">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Error Details'));
    expect(screen.getByText('TestComponent (page)')).toBeInTheDocument();
  });

  it('should send error to Sentry if available', () => {
    const mockSentry = {
      captureException: vi.fn(),
    };
    (window as any).Sentry = mockSentry;

    render(
      <ErrorBoundary context="TestComponent" level="component">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(mockSentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        contexts: {
          react: {
            componentStack: expect.any(String),
          },
        },
        tags: {
          errorBoundary: true,
          level: 'component',
          context: 'TestComponent',
        },
      })
    );

    delete (window as any).Sentry;
  });

  it('should handle multiple error boundaries with different contexts', () => {
    render(
      <ErrorBoundary context="OuterComponent" level="page">
        <ErrorBoundary context="InnerComponent" level="component">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </ErrorBoundary>
    );

    // Inner boundary should catch the error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Error Details'));
    expect(screen.getByText('InnerComponent (component)')).toBeInTheDocument();
  });

  it('should generate unique error IDs for different errors', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Error Details'));
    const firstErrorId = screen.getByText(/boundary-\d+-\w+/).textContent;

    // Reset and trigger another error
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Error Details'));
    const secondErrorId = screen.getByText(/boundary-\d+-\w+/).textContent;

    expect(firstErrorId).not.toBe(secondErrorId);
  });
});