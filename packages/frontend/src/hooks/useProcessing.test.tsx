/**
 * useProcessing Hook Tests
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider } from '../contexts/AppContext';
import { useProcessing } from './useProcessing';
import type { ProcessingRequest } from '../types';

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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('useProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useProcessing(), { wrapper });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should provide processing actions', () => {
    const { result } = renderHook(() => useProcessing(), { wrapper });

    expect(typeof result.current.startProcessing).toBe('function');
    expect(typeof result.current.retryProcessing).toBe('function');
    expect(typeof result.current.cancelProcessing).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('should clear error state', () => {
    const { result } = renderHook(() => useProcessing(), { wrapper });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });

  it('should reset all state', () => {
    const { result } = renderHook(() => useProcessing(), { wrapper });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe(null);
  });
});