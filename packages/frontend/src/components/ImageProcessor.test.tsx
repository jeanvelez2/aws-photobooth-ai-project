/**
 * ImageProcessor Component Tests
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../contexts/AppContext';
import ImageProcessor from './ImageProcessor';
import type { ProcessingRequest, ProcessingResult } from '../types';

// Mock the processing service
vi.mock('../services/processingService', () => ({
  processingService: {
    startProcessing: vi.fn(),
    pollProcessingStatus: vi.fn(),

    cancelProcessing: vi.fn(),
  }
}));

const mockRequest: ProcessingRequest = {
  photoId: 'photo-123',
  themeId: 'barbarian',
  outputFormat: 'jpeg',
  originalImageUrl: 'https://example.com/photo.jpg'
};

const mockResult: ProcessingResult = {
  id: 'process-123',
  status: 'processing',
  createdAt: new Date(),
};

const renderImageProcessor = (props: Partial<React.ComponentProps<typeof ImageProcessor>> = {}) => {
  const defaultProps = {
    request: mockRequest,
    onComplete: vi.fn(),
    onError: vi.fn(),
    onCancel: vi.fn(),
  };

  return render(
    <AppProvider>
      <ImageProcessor {...defaultProps} {...props} />
    </AppProvider>
  );
};

describe('ImageProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render processing UI', async () => {
    await act(async () => {
      renderImageProcessor();
    });

    expect(screen.getByText('Processing Your Image')).toBeInTheDocument();
    expect(screen.getByText('AI Processing in Progress')).toBeInTheDocument();
    expect(screen.getByText('Cancel Processing')).toBeInTheDocument();
  });

  it('should show progress steps', async () => {
    await act(async () => {
      renderImageProcessor();
    });

    expect(screen.getByText('Face Detection')).toBeInTheDocument();
    expect(screen.getByText('Face Alignment')).toBeInTheDocument();
    expect(screen.getByText('Image Blending')).toBeInTheDocument();
    expect(screen.getByText('Finalization')).toBeInTheDocument();
  });

  it('should show cancel button', async () => {
    await act(async () => {
      renderImageProcessor();
    });

    expect(screen.getByText('Cancel Processing')).toBeInTheDocument();
  });

  it('should estimate time remaining', async () => {
    await act(async () => {
      renderImageProcessor();
    });

    // Should show initial estimate - use getAllByText to handle multiple matches
    expect(screen.getAllByText(/15 seconds/)[0]).toBeInTheDocument();
  });

  it('should show processing tips', async () => {
    await act(async () => {
      renderImageProcessor();
    });

    expect(screen.getByText('While you wait:')).toBeInTheDocument();
    expect(screen.getByText(/27\+ facial landmarks/)).toBeInTheDocument();
    expect(screen.getByText(/Advanced blending/)).toBeInTheDocument();
    expect(screen.getByText(/Color correction/)).toBeInTheDocument();
  });
});