import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CapturePage from './CapturePage';
import { AppProvider } from '../contexts/AppContext';
import type { CapturedPhoto } from '../types';

// Mock the CameraCapture component
vi.mock('../components/CameraCapture', () => ({
  default: ({ onPhotoCapture, className }: { onPhotoCapture: (photo: CapturedPhoto) => void; className?: string }) => (
    <div className={className} data-testid="camera-capture">
      <button
        onClick={() => onPhotoCapture({
          id: 'test-photo-id',
          blob: new Blob(['test'], { type: 'image/jpeg' }),
          dataUrl: 'data:image/jpeg;base64,test',
          timestamp: new Date(),
          dimensions: { width: 1920, height: 1080 }
        })}
        data-testid="capture-button"
      >
        Capture Photo
      </button>
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

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AppProvider>
        {component}
      </AppProvider>
    </BrowserRouter>
  );
};

describe('CapturePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders capture page with title and instructions', () => {
    renderWithProviders(<CapturePage />);
    
    expect(screen.getByText('Take Your Photo')).toBeInTheDocument();
    expect(screen.getByText(/Position yourself in the camera frame/)).toBeInTheDocument();
    expect(screen.getByText(/Make sure you're well-lit/)).toBeInTheDocument();
  });

  it('renders camera capture component initially', () => {
    renderWithProviders(<CapturePage />);
    
    expect(screen.getByTestId('camera-capture')).toBeInTheDocument();
    expect(screen.getByTestId('capture-button')).toBeInTheDocument();
  });

  it('renders tips section', () => {
    renderWithProviders(<CapturePage />);
    
    expect(screen.getByText('Tips for the best results:')).toBeInTheDocument();
    expect(screen.getByText('Ensure good lighting on your face')).toBeInTheDocument();
    expect(screen.getByText('Look directly at the camera')).toBeInTheDocument();
    expect(screen.getByText('Keep your face centered in the frame')).toBeInTheDocument();
    expect(screen.getByText('Avoid extreme angles or poses')).toBeInTheDocument();
  });

  it('switches to photo preview mode after capturing photo', async () => {
    renderWithProviders(<CapturePage />);
    
    const captureButton = screen.getByTestId('capture-button');
    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(screen.getByAltText('Captured photo')).toBeInTheDocument();
      expect(screen.getByText('Retake Photo')).toBeInTheDocument();
      expect(screen.getByText('Continue to Themes')).toBeInTheDocument();
    });
  });

  it('displays photo information after capture', async () => {
    renderWithProviders(<CapturePage />);
    
    const captureButton = screen.getByTestId('capture-button');
    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(screen.getByText('Photo captured: 1920 × 1080px')).toBeInTheDocument();
      expect(screen.getByText(/Size: \d+\.\d+ MB/)).toBeInTheDocument();
    });
  });

  it('allows retaking photo', async () => {
    renderWithProviders(<CapturePage />);
    
    // Capture photo first
    const captureButton = screen.getByTestId('capture-button');
    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(screen.getByText('Retake Photo')).toBeInTheDocument();
    });

    // Click retake
    const retakeButton = screen.getByText('Retake Photo');
    fireEvent.click(retakeButton);

    await waitFor(() => {
      expect(screen.getByTestId('camera-capture')).toBeInTheDocument();
      expect(screen.queryByAltText('Captured photo')).not.toBeInTheDocument();
    });
  });

  it('navigates to themes page when continue is clicked', async () => {
    renderWithProviders(<CapturePage />);
    
    // Capture photo first
    const captureButton = screen.getByTestId('capture-button');
    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(screen.getByText('Continue to Themes')).toBeInTheDocument();
    });

    // Click continue
    const continueButton = screen.getByText('Continue to Themes');
    fireEvent.click(continueButton);

    expect(mockNavigate).toHaveBeenCalledWith('/themes');
  });

  it('does not show continue button without captured photo', () => {
    renderWithProviders(<CapturePage />);
    
    expect(screen.queryByText('Continue to Themes')).not.toBeInTheDocument();
  });
});