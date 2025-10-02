import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ResultPage from './ResultPage';
import { AppProvider } from '../contexts/AppContext';

// Mock the ImagePreview component
vi.mock('../components/ImagePreview', () => ({
  default: ({ 
    result, 
    theme, 
    onDownload, 
    onRetry, 
    onStartOver 
  }: { 
    result: any; 
    theme: any; 
    onDownload: (filename?: string) => void; 
    onRetry: () => void; 
    onStartOver: () => void; 
  }) => (
    <div data-testid="image-preview">
      <div>Result: {result.status}</div>
      <div>Theme: {theme?.name}</div>
      <button onClick={() => onDownload('custom-filename.jpg')} data-testid="download-button">
        Download
      </button>
      <button onClick={onRetry} data-testid="retry-button">Try Another Theme</button>
      <button onClick={onStartOver} data-testid="start-over-button">Start Over</button>
    </div>
  )
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
  const TestProvider = ({ children }: { children: React.ReactNode }) => {
    return (
      <BrowserRouter>
        <AppProvider initialState={initialState}>
          {children}
        </AppProvider>
      </BrowserRouter>
    );
  };

  return render(<TestProvider>{component}</TestProvider>);
};

describe('ResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders result page with title and success message', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'barbarian', name: 'Barbarian Warrior' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://example.com/result.jpg',
          processingTime: 8500
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    expect(screen.getByText('Your AI Photobooth Result')).toBeInTheDocument();
    expect(screen.getByText(/Amazing! Your face has been seamlessly integrated/)).toBeInTheDocument();
    expect(screen.getByText(/Processing completed in 9 seconds/)).toBeInTheDocument();
  });

  it('displays theme name in description', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'greek', name: 'Greek God' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://example.com/result.jpg',
          processingTime: 5000
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    expect(screen.getByText(/integrated into the Greek God theme/)).toBeInTheDocument();
  });

  it('renders ImagePreview component with correct props', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'barbarian', name: 'Barbarian Warrior' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://example.com/result.jpg',
          processingTime: 8500
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    expect(screen.getByTestId('image-preview')).toBeInTheDocument();
    expect(screen.getByText('Result: completed')).toBeInTheDocument();
    expect(screen.getByText('Theme: Barbarian Warrior')).toBeInTheDocument();
  });

  it('renders success message with processing details', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'barbarian', name: 'Barbarian Warrior' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://example.com/result.jpg',
          processingTime: 8500
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    expect(screen.getByText('Processing completed successfully!')).toBeInTheDocument();
    expect(screen.getByText(/Your image has been processed with high-quality AI face blending/)).toBeInTheDocument();
  });

  it('handles download action', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'barbarian', name: 'Barbarian Warrior' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://example.com/result.jpg',
          processingTime: 8500
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    const downloadButton = screen.getByTestId('download-button');
    fireEvent.click(downloadButton);

    expect(consoleSpy).toHaveBeenCalledWith('Downloaded image:', 'custom-filename.jpg');
    
    consoleSpy.mockRestore();
  });

  it('handles start over action', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'barbarian', name: 'Barbarian Warrior' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://example.com/result.jpg',
          processingTime: 8500
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    const startOverButton = screen.getByTestId('start-over-button');
    fireEvent.click(startOverButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('handles try another theme action', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'barbarian', name: 'Barbarian Warrior' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://example.com/result.jpg',
          processingTime: 8500
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    const retryButton = screen.getByTestId('retry-button');
    fireEvent.click(retryButton);

    expect(mockNavigate).toHaveBeenCalledWith('/themes');
  });

  it('redirects to processing page when no result is available', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'barbarian', name: 'Barbarian Warrior' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: null
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    expect(mockNavigate).toHaveBeenCalledWith('/process');
  });

  it('redirects to processing page when result status is not completed', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'barbarian', name: 'Barbarian Warrior' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'processing',
          resultUrl: null,
          processingTime: null
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    expect(mockNavigate).toHaveBeenCalledWith('/process');
  });

  it('handles missing processing time gracefully', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: { id: 'barbarian', name: 'Barbarian Warrior' },
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://example.com/result.jpg',
          processingTime: null
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    expect(screen.getByText(/Processing completed in N\/A seconds/)).toBeInTheDocument();
  });

  it('handles missing theme gracefully', () => {
    const initialState = {
      app: {
        currentPhoto: { id: 'test-photo' },
        selectedTheme: null,
        selectedVariant: null,
        currentStep: 'result',
        processingStatus: {
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://example.com/result.jpg',
          processingTime: 8500
        }
      }
    };

    renderWithProviders(<ResultPage />, initialState);

    expect(screen.getByText(/integrated into the selected theme/)).toBeInTheDocument();
  });
});