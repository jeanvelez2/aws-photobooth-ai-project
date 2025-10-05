import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProcessingPage from './ProcessingPage';
import { AppProvider } from '../contexts/AppContext';
import type { ProcessingError as ProcessingErrorType } from '../types';

// Mock the ImageProcessor component
vi.mock('../components/ImageProcessor', () => ({
  default: ({ request, onCancel }: { request: any; onCancel: () => void }) => (
    <div data-testid="image-processor">
      <div>Processing: {request.themeId}</div>
      <button onClick={onCancel} data-testid="cancel-button">Cancel</button>
    </div>
  )
}));

// Mock the ProcessingError component
vi.mock('../components/ProcessingError', () => ({
  default: ({ 
    error, 
    onRetry, 
    onStartOver, 
    onGoBack 
  }: { 
    error: ProcessingErrorType; 
    onRetry?: () => void; 
    onStartOver: () => void; 
    onGoBack: () => void; 
  }) => (
    <div data-testid="processing-error">
      <div>Error: {error.message}</div>
      {onRetry && <button onClick={onRetry} data-testid="retry-button">Retry</button>}
      <button onClick={onStartOver} data-testid="start-over-button">Start Over</button>
      <button onClick={onGoBack} data-testid="go-back-button">Go Back</button>
    </div>
  )
}));

// Mock the useProcessing hook
const mockStartProcessing = vi.fn();
const mockRetryProcessing = vi.fn();
const mockClearError = vi.fn();
const mockReset = vi.fn();

vi.mock('../hooks/useProcessing', () => ({
  useProcessing: ({ onComplete, onError }: { onComplete: (result: any) => void; onError: (error: any) => void }) => ({
    isProcessing: false,
    result: null,
    error: null,
    startProcessing: mockStartProcessing,
    retryProcessing: mockRetryProcessing,
    clearError: mockClearError,
    reset: mockReset
  })
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create a custom provider with initial state
const renderWithProviders = (component: React.ReactElement, initialState?: any) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  const TestProvider = ({ children }: { children: React.ReactNode }) => {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppProvider initialState={initialState}>
            {children}
          </AppProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  return render(<TestProvider>{component}</TestProvider>);
};

describe('ProcessingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when preparing request', () => {
    renderWithProviders(<ProcessingPage />);
    
    expect(screen.getByText('Preparing your image for processing...')).toBeInTheDocument();
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument(); // spinner
  });

  it('redirects to capture page when no photo is available', () => {
    const initialState = {
      app: {
        currentPhoto: null,
        selectedTheme: { id: 'barbarian', name: 'Barbarian' },
        selectedVariant: null,
        currentStep: 'processing',
        processingStatus: null
      }
    };

    renderWithProviders(<ProcessingPage />, initialState);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('redirects to theme selection when no theme is selected', () => {
    const initialState = {
      app: {
        currentPhoto: { 
          id: 'test-photo', 
          dataUrl: 'data:image/jpeg;base64,test',
          blob: new Blob(),
          timestamp: new Date(),
          dimensions: { width: 1920, height: 1080 }
        },
        selectedTheme: null,
        selectedVariant: null,
        currentStep: 'processing',
        processingStatus: null
      }
    };

    renderWithProviders(<ProcessingPage />, initialState);

    expect(mockNavigate).toHaveBeenCalledWith('/themes');
  });

  it('renders ImageProcessor when processing request is ready', () => {
    const initialState = {
      app: {
        currentPhoto: { 
          id: 'test-photo', 
          dataUrl: 'data:image/jpeg;base64,test',
          blob: new Blob(),
          timestamp: new Date(),
          dimensions: { width: 1920, height: 1080 }
        },
        selectedTheme: { id: 'barbarian', name: 'Barbarian' },
        selectedVariant: null,
        currentStep: 'processing',
        processingStatus: null
      }
    };

    renderWithProviders(<ProcessingPage />, initialState);

    expect(screen.getByTestId('image-processor')).toBeInTheDocument();
    expect(screen.getByText('Processing: barbarian')).toBeInTheDocument();
  });

  it('starts processing when request is ready', async () => {
    const initialState = {
      app: {
        currentPhoto: { 
          id: 'test-photo', 
          dataUrl: 'data:image/jpeg;base64,test',
          blob: new Blob(),
          timestamp: new Date(),
          dimensions: { width: 1920, height: 1080 }
        },
        selectedTheme: { id: 'barbarian', name: 'Barbarian' },
        selectedVariant: { id: 'variant-1', name: 'Classic' },
        currentStep: 'processing',
        processingStatus: null
      }
    };

    renderWithProviders(<ProcessingPage />, initialState);

    await waitFor(() => {
      expect(mockStartProcessing).toHaveBeenCalledWith({
        photoId: 'test-photo',
        themeId: 'barbarian',
        variantId: 'variant-1',
        outputFormat: 'jpeg',
        originalImageUrl: 'data:image/jpeg;base64,test'
      });
    });
  });

  it('handles cancel button click', () => {
    const initialState = {
      app: {
        currentPhoto: { 
          id: 'test-photo', 
          dataUrl: 'data:image/jpeg;base64,test',
          blob: new Blob(),
          timestamp: new Date(),
          dimensions: { width: 1920, height: 1080 }
        },
        selectedTheme: { id: 'barbarian', name: 'Barbarian' },
        selectedVariant: null,
        currentStep: 'processing',
        processingStatus: null
      }
    };

    renderWithProviders(<ProcessingPage />, initialState);

    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);

    expect(mockReset).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/themes');
  });
});

// Test error states by mocking the useProcessing hook differently
describe('ProcessingPage - Error States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ProcessingError component when error occurs', () => {
    // Mock useProcessing to return an error
    vi.doMock('../hooks/useProcessing', () => ({
      useProcessing: () => ({
        isProcessing: false,
        result: null,
        error: {
          type: 'NO_FACE_DETECTED',
          message: 'No face detected in the image',
          retryable: false
        },
        startProcessing: mockStartProcessing,
        retryProcessing: mockRetryProcessing,
        clearError: mockClearError,
        reset: mockReset
      })
    }));

    const initialState = {
      app: {
        currentPhoto: { 
          id: 'test-photo', 
          dataUrl: 'data:image/jpeg;base64,test',
          blob: new Blob(),
          timestamp: new Date(),
          dimensions: { width: 1920, height: 1080 }
        },
        selectedTheme: { id: 'barbarian', name: 'Barbarian' },
        selectedVariant: null,
        currentStep: 'processing',
        processingStatus: null
      }
    };

    renderWithProviders(<ProcessingPage />, initialState);

    expect(screen.getByTestId('processing-error')).toBeInTheDocument();
    expect(screen.getByText('Error: No face detected in the image')).toBeInTheDocument();
  });
});