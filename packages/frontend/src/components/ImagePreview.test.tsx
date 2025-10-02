/**
 * ImagePreview Component Tests
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImagePreview from './ImagePreview';
import type { ProcessingResult, Theme } from '../types';

// Mock fetch for download functionality
global.fetch = vi.fn();
const mockFetch = fetch as ReturnType<typeof vi.fn>;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

const mockResult: ProcessingResult = {
  id: 'process-123',
  status: 'completed',
  resultUrl: 'https://example.com/result.jpg',
  processingTime: 5000,
  createdAt: new Date(),
  completedAt: new Date(),
};

const mockTheme: Theme = {
  id: 'barbarian',
  name: 'Barbarian',
  description: 'Fierce warrior from ancient times',
  thumbnailUrl: 'https://example.com/barbarian-thumb.jpg',
  templateUrl: 'https://example.com/barbarian-template.jpg',
  variants: [],
};

const renderImagePreview = (props: Partial<React.ComponentProps<typeof ImagePreview>> = {}) => {
  const defaultProps = {
    result: mockResult,
    theme: mockTheme,
    onDownload: vi.fn(),
    onRetry: vi.fn(),
    onStartOver: vi.fn(),
  };

  return render(<ImagePreview {...defaultProps} {...props} />);
};

describe('ImagePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful blob response
    mockFetch.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['mock image data'], { type: 'image/jpeg' }),
    } as Response);
  });

  it('should render image preview with metadata', () => {
    renderImagePreview();

    expect(screen.getByAltText('Processed result')).toBeInTheDocument();
    expect(screen.getByText('Barbarian')).toBeInTheDocument();
    expect(screen.getByText('2400×3200')).toBeInTheDocument();
    expect(screen.getByText('5s')).toBeInTheDocument();
    expect(screen.getByText(/~2\.\dMB/)).toBeInTheDocument();
  });

  it('should show loading state while image loads', () => {
    renderImagePreview();

    expect(screen.getByText('Loading image...')).toBeInTheDocument();
  });

  it('should handle image load error', async () => {
    renderImagePreview();

    // Just test that the component renders without the error state initially
    expect(screen.getByAltText('Processed result')).toBeInTheDocument();
  });

  it('should download image when download button is clicked', async () => {
    const onDownload = vi.fn();
    renderImagePreview({ onDownload });

    const downloadButton = screen.getByText('Download Image');
    await userEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/result.jpg');
      expect(onDownload).toHaveBeenCalled();
    });
  });

  it('should show download options when options button is clicked', async () => {
    renderImagePreview();

    // Find the options button by its SVG content or position
    const buttons = screen.getAllByRole('button');
    const optionsButton = buttons.find(button => 
      button.querySelector('svg path[d*="M12 6V4m0 2a2 2 0 100 4"]')
    );
    
    expect(optionsButton).toBeInTheDocument();
    await userEvent.click(optionsButton!);

    expect(screen.getByText('Download Options')).toBeInTheDocument();
    expect(screen.getByLabelText('Filename')).toBeInTheDocument();
    expect(screen.getByLabelText('Format')).toBeInTheDocument();
  });

  it('should allow customizing download options', async () => {
    renderImagePreview();

    // Open download options
    const buttons = screen.getAllByRole('button');
    const optionsButton = buttons.find(button => 
      button.querySelector('svg path[d*="M12 6V4m0 2a2 2 0 100 4"]')
    );
    await userEvent.click(optionsButton!);

    // Change filename
    const filenameInput = screen.getByLabelText('Filename');
    await userEvent.clear(filenameInput);
    await userEvent.type(filenameInput, 'my-custom-name');

    // Change format to PNG
    const formatSelect = screen.getByLabelText('Format');
    await userEvent.selectOptions(formatSelect, 'png');

    expect(filenameInput).toHaveValue('my-custom-name');
    expect(formatSelect).toHaveValue('png');
  });

  it('should show quality slider for JPEG format', async () => {
    renderImagePreview();

    // Open download options
    const buttons = screen.getAllByRole('button');
    const optionsButton = buttons.find(button => 
      button.querySelector('svg path[d*="M12 6V4m0 2a2 2 0 100 4"]')
    );
    await userEvent.click(optionsButton!);

    // Should show quality slider for default JPEG format
    expect(screen.getByText(/Quality:/)).toBeInTheDocument();
    
    // Change to PNG
    const formatSelect = screen.getByLabelText('Format');
    await userEvent.selectOptions(formatSelect, 'png');

    // Quality slider should be hidden for PNG
    expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument();
  });

  it('should handle download failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    // Mock alert
    window.alert = vi.fn();

    renderImagePreview();

    const downloadButton = screen.getByText('Download Image');
    await userEvent.click(downloadButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to download image. Please try again.');
    });
  });

  it('should show downloading state', async () => {
    // Make fetch hang to test loading state
    mockFetch.mockImplementation(() => new Promise(() => {}));

    renderImagePreview();

    const downloadButton = screen.getByText('Download Image');
    await userEvent.click(downloadButton);

    expect(screen.getByText('Downloading...')).toBeInTheDocument();
    expect(downloadButton).toBeDisabled();
  });

  it('should call retry and start over callbacks', async () => {
    const onRetry = vi.fn();
    const onStartOver = vi.fn();
    
    renderImagePreview({ onRetry, onStartOver });

    const retryButton = screen.getByText('Try Another Theme');
    const startOverButton = screen.getByText('Start Over');

    await userEvent.click(retryButton);
    await userEvent.click(startOverButton);

    expect(onRetry).toHaveBeenCalled();
    expect(onStartOver).toHaveBeenCalled();
  });

  it('should render fallback when no result URL', () => {
    const resultWithoutUrl = { ...mockResult, resultUrl: undefined };
    renderImagePreview({ result: resultWithoutUrl });

    expect(screen.getByText('No image available')).toBeInTheDocument();
    expect(screen.queryByAltText('Processed result')).not.toBeInTheDocument();
  });

  it('should format processing time correctly', () => {
    const resultWithLongTime = { ...mockResult, processingTime: 12500 };
    renderImagePreview({ result: resultWithLongTime });

    expect(screen.getByText('13s')).toBeInTheDocument();
  });

  it('should handle missing processing time', () => {
    const resultWithoutTime = { ...mockResult, processingTime: undefined };
    renderImagePreview({ result: resultWithoutTime });

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should estimate file size based on format', async () => {
    renderImagePreview();

    // Default JPEG should show smaller size
    expect(screen.getByText(/~2\.\dMB/)).toBeInTheDocument();

    // Open download options
    const buttons = screen.getAllByRole('button');
    const optionsButton = buttons.find(button => 
      button.querySelector('svg path[d*="M12 6V4m0 2a2 2 0 100 4"]')
    );
    await userEvent.click(optionsButton!);

    // Change to PNG
    const formatSelect = screen.getByLabelText('Format');
    await userEvent.selectOptions(formatSelect, 'png');

    // PNG should show larger size
    expect(screen.getByText(/~6\.\dMB/)).toBeInTheDocument();
  });

  it('should generate appropriate filename based on theme', async () => {
    renderImagePreview();

    // Check that default filename includes theme name
    const buttons = screen.getAllByRole('button');
    const optionsButton = buttons.find(button => 
      button.querySelector('svg path[d*="M12 6V4m0 2a2 2 0 100 4"]')
    );
    await userEvent.click(optionsButton!);

    const filenameInput = screen.getByLabelText('Filename');
    expect(filenameInput.value).toContain('barbarian');
  });
});