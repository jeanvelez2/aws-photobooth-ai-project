import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { AppProvider } from '../../contexts/AppContext';
import * as uploadService from '../../services/uploadService';
import * as processingService from '../../services/processingService';

// Mock services
vi.mock('../../services/uploadService', () => ({
  uploadService: {
    uploadImage: vi.fn(),
    generatePresignedUrl: vi.fn(),
  },
}));

vi.mock('../../services/processingService', () => ({
  processingService: {
    startProcessing: vi.fn(),
    getProcessingStatus: vi.fn(),
  },
}));

// Mock camera API
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock canvas for image capture
const mockCanvas = {
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  })),
  toBlob: vi.fn((callback) => {
    callback(new Blob(['mock-image'], { type: 'image/jpeg' }));
  }),
  toDataURL: vi.fn(() => 'data:image/jpeg;base64,mock-data'),
  width: 1920,
  height: 1080,
};

global.HTMLCanvasElement.prototype.getContext = mockCanvas.getContext;
global.HTMLCanvasElement.prototype.toBlob = mockCanvas.toBlob;
global.HTMLCanvasElement.prototype.toDataURL = mockCanvas.toDataURL;

const renderApp = () => {
  return render(<App />);
};

describe('Complete User Workflow E2E Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Happy Path: Complete Photo Processing Workflow', () => {
    it('should complete full workflow from capture to result', async () => {
      // Mock successful upload
      vi.mocked(uploadService.uploadService.generatePresignedUrl).mockResolvedValue({
        uploadUrl: 'https://s3.amazonaws.com/bucket/presigned-url',
        key: 'uploads/2024-01-15/test-image.jpg',
        expiresIn: 900,
      });

      vi.mocked(uploadService.uploadService.uploadImage).mockResolvedValue({
        success: true,
        key: 'uploads/2024-01-15/test-image.jpg',
      });

      // Mock successful processing
      vi.mocked(processingService.processingService.startProcessing).mockResolvedValue({
        jobId: 'job-123',
        status: 'queued',
        estimatedTime: 8000,
      });

      vi.mocked(processingService.processingService.getProcessingStatus)
        .mockResolvedValueOnce({
          id: 'job-123',
          status: 'processing',
          progress: 25,
        })
        .mockResolvedValueOnce({
          id: 'job-123',
          status: 'processing',
          progress: 75,
        })
        .mockResolvedValue({
          id: 'job-123',
          status: 'completed',
          resultUrl: 'https://s3.amazonaws.com/bucket/processed/result.jpg',
          processingTime: 8500,
        });

      renderApp();

      // Step 1: Verify we're on the capture page
      expect(screen.getByText('Take Your Photo')).toBeInTheDocument();
      expect(screen.getByText(/Position yourself in the camera frame/)).toBeInTheDocument();

      // Step 2: Simulate camera access and photo capture
      await waitFor(() => {
        expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
      });

      const captureButton = screen.getByText('Capture Photo');
      await user.click(captureButton);

      // Step 3: Verify photo preview and continue to themes
      await waitFor(() => {
        expect(screen.getByAltText('Captured photo')).toBeInTheDocument();
        expect(screen.getByText('Continue to Themes')).toBeInTheDocument();
      });

      const continueButton = screen.getByText('Continue to Themes');
      await user.click(continueButton);

      // Step 4: Verify theme selection page
      await waitFor(() => {
        expect(screen.getByText('Choose Your Theme')).toBeInTheDocument();
      });

      // Select a theme
      const barbarianTheme = screen.getByText('Barbarian Warrior');
      await user.click(barbarianTheme);

      // Continue to processing
      const processButton = screen.getByText('Continue to Processing');
      await waitFor(() => {
        expect(processButton).not.toBeDisabled();
      });
      await user.click(processButton);

      // Step 5: Verify processing page
      await waitFor(() => {
        expect(screen.getByText(/Processing your image/)).toBeInTheDocument();
      });

      // Wait for processing to complete
      await waitFor(
        () => {
          expect(screen.getByText('Your AI Photobooth Result')).toBeInTheDocument();
        },
        { timeout: 10000 }
      );

      // Step 6: Verify result page
      expect(screen.getByText(/Amazing! Your face has been seamlessly integrated/)).toBeInTheDocument();
      expect(screen.getByText(/Processing completed in/)).toBeInTheDocument();
      expect(screen.getByText('Download Image')).toBeInTheDocument();

      // Verify services were called correctly
      expect(uploadService.uploadService.generatePresignedUrl).toHaveBeenCalled();
      expect(uploadService.uploadService.uploadImage).toHaveBeenCalled();
      expect(processingService.processingService.startProcessing).toHaveBeenCalledWith({
        imageKey: 'uploads/2024-01-15/test-image.jpg',
        themeId: 'barbarian',
        outputFormat: 'jpeg',
      });
    });

    it('should handle theme variant selection', async () => {
      renderApp();

      // Navigate to theme selection (skip capture for this test)
      const skipCaptureButton = screen.getByText('Skip to Themes');
      await user.click(skipCaptureButton);

      // Select barbarian theme (has variants)
      const barbarianTheme = screen.getByText('Barbarian Warrior');
      await user.click(barbarianTheme);

      // Verify variants are shown
      await waitFor(() => {
        expect(screen.getByText('Classic')).toBeInTheDocument();
        expect(screen.getByText('Battle Ready')).toBeInTheDocument();
      });

      // Select a variant
      const classicVariant = screen.getByText('Classic');
      await user.click(classicVariant);

      // Verify variant selection is reflected
      expect(screen.getByText(/Selected:.*Barbarian Warrior.*Classic/)).toBeInTheDocument();

      // Continue to processing
      const processButton = screen.getByText('Continue to Processing');
      await user.click(processButton);

      // Verify variant is included in processing request
      await waitFor(() => {
        expect(processingService.processingService.startProcessing).toHaveBeenCalledWith(
          expect.objectContaining({
            themeId: 'barbarian',
            variantId: 'barbarian-classic',
          })
        );
      });
    });
  });

  describe('Error Handling Workflows', () => {
    it('should handle camera access denied', async () => {
      // Mock camera access denied
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/Camera access is required/)).toBeInTheDocument();
        expect(screen.getByText('Enable Camera')).toBeInTheDocument();
      });

      // Verify retry functionality
      const enableButton = screen.getByText('Enable Camera');
      await user.click(enableButton);

      // Should attempt to access camera again
      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
    });

    it('should handle upload failure', async () => {
      // Mock upload failure
      vi.mocked(uploadService.uploadService.generatePresignedUrl).mockRejectedValue(
        new Error('Upload service unavailable')
      );

      renderApp();

      // Complete photo capture
      await waitFor(() => {
        expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
      });

      const captureButton = screen.getByText('Capture Photo');
      await user.click(captureButton);

      const continueButton = screen.getByText('Continue to Themes');
      await user.click(continueButton);

      // Select theme and try to process
      const barbarianTheme = screen.getByText('Barbarian Warrior');
      await user.click(barbarianTheme);

      const processButton = screen.getByText('Continue to Processing');
      await user.click(processButton);

      // Should show upload error
      await waitFor(() => {
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
        expect(screen.getByText('Retry Upload')).toBeInTheDocument();
      });
    });

    it('should handle processing failure with retry', async () => {
      // Mock successful upload but failed processing
      vi.mocked(uploadService.uploadService.generatePresignedUrl).mockResolvedValue({
        uploadUrl: 'https://s3.amazonaws.com/bucket/presigned-url',
        key: 'uploads/2024-01-15/test-image.jpg',
        expiresIn: 900,
      });

      vi.mocked(uploadService.uploadService.uploadImage).mockResolvedValue({
        success: true,
        key: 'uploads/2024-01-15/test-image.jpg',
      });

      vi.mocked(processingService.processingService.startProcessing).mockResolvedValue({
        jobId: 'job-123',
        status: 'queued',
        estimatedTime: 8000,
      });

      // Mock processing failure
      vi.mocked(processingService.processingService.getProcessingStatus).mockResolvedValue({
        id: 'job-123',
        status: 'failed',
        error: 'NO_FACE_DETECTED',
        errorMessage: 'No face detected in the uploaded image',
      });

      renderApp();

      // Complete workflow to processing
      await waitFor(() => {
        expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
      });

      const captureButton = screen.getByText('Capture Photo');
      await user.click(captureButton);

      const continueButton = screen.getByText('Continue to Themes');
      await user.click(continueButton);

      const barbarianTheme = screen.getByText('Barbarian Warrior');
      await user.click(barbarianTheme);

      const processButton = screen.getByText('Continue to Processing');
      await user.click(processButton);

      // Should show processing error
      await waitFor(() => {
        expect(screen.getByText('No face detected in the uploaded image')).toBeInTheDocument();
        expect(screen.getByText('Start Over')).toBeInTheDocument();
        expect(screen.getByText('Go Back')).toBeInTheDocument();
      });

      // Test start over functionality
      const startOverButton = screen.getByText('Start Over');
      await user.click(startOverButton);

      // Should return to capture page
      await waitFor(() => {
        expect(screen.getByText('Take Your Photo')).toBeInTheDocument();
      });
    });

    it('should handle network connectivity issues', async () => {
      // Mock network error
      vi.mocked(processingService.processingService.startProcessing).mockRejectedValue(
        new Error('Network error')
      );

      renderApp();

      // Complete workflow to processing
      await waitFor(() => {
        expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
      });

      const captureButton = screen.getByText('Capture Photo');
      await user.click(captureButton);

      const continueButton = screen.getByText('Continue to Themes');
      await user.click(continueButton);

      const barbarianTheme = screen.getByText('Barbarian Warrior');
      await user.click(barbarianTheme);

      const processButton = screen.getByText('Continue to Processing');
      await user.click(processButton);

      // Should show network error with retry option
      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Test retry functionality
      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);

      // Should attempt processing again
      expect(processingService.processingService.startProcessing).toHaveBeenCalledTimes(2);
    });
  });

  describe('Navigation and State Management', () => {
    it('should maintain state when navigating back and forth', async () => {
      renderApp();

      // Capture photo
      await waitFor(() => {
        expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
      });

      const captureButton = screen.getByText('Capture Photo');
      await user.click(captureButton);

      const continueButton = screen.getByText('Continue to Themes');
      await user.click(continueButton);

      // Go to theme selection and select theme
      const barbarianTheme = screen.getByText('Barbarian Warrior');
      await user.click(barbarianTheme);

      // Navigate back to capture
      const backButton = screen.getByText('Back to Camera');
      await user.click(backButton);

      // Should still show captured photo
      await waitFor(() => {
        expect(screen.getByAltText('Captured photo')).toBeInTheDocument();
      });

      // Navigate forward again
      const continueAgainButton = screen.getByText('Continue to Themes');
      await user.click(continueAgainButton);

      // Should still have theme selected
      await waitFor(() => {
        expect(screen.getByText(/Selected:.*Barbarian Warrior/)).toBeInTheDocument();
      });
    });

    it('should handle browser refresh gracefully', async () => {
      renderApp();

      // Simulate browser refresh by re-rendering
      const { rerender } = renderApp();

      // Should return to initial state
      expect(screen.getByText('Take Your Photo')).toBeInTheDocument();
      expect(screen.queryByAltText('Captured photo')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should be keyboard navigable', async () => {
      renderApp();

      // Test tab navigation
      await user.tab();
      expect(screen.getByText('Capture Photo')).toHaveFocus();

      // Test enter key activation
      await user.keyboard('{Enter}');

      // Should capture photo
      await waitFor(() => {
        expect(screen.getByAltText('Captured photo')).toBeInTheDocument();
      });
    });

    it('should provide proper ARIA labels and roles', () => {
      renderApp();

      // Check for proper ARIA attributes
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Check for proper headings hierarchy
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should show loading states appropriately', async () => {
      renderApp();

      // Mock slow processing
      vi.mocked(processingService.processingService.getProcessingStatus).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          id: 'job-123',
          status: 'processing',
          progress: 50,
        }), 1000))
      );

      // Complete workflow to processing
      await waitFor(() => {
        expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
      });

      const captureButton = screen.getByText('Capture Photo');
      await user.click(captureButton);

      const continueButton = screen.getByText('Continue to Themes');
      await user.click(continueButton);

      const barbarianTheme = screen.getByText('Barbarian Warrior');
      await user.click(barbarianTheme);

      const processButton = screen.getByText('Continue to Processing');
      await user.click(processButton);

      // Should show loading indicator
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/Processing your image/)).toBeInTheDocument();
    });
  });
});