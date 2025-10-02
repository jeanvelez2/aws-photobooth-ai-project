/**
 * ProcessingService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProcessingService } from './processingService';
import type { ProcessingRequest, ProcessingResult } from '../types';

// Mock fetch globally
global.fetch = vi.fn();
const mockFetch = fetch as ReturnType<typeof vi.fn>;

describe('ProcessingService', () => {
  let service: ProcessingService;
  
  beforeEach(() => {
    service = new ProcessingService('/api');
    vi.clearAllMocks();
  });

  describe('startProcessing', () => {
    it('should start processing successfully', async () => {
      const request: ProcessingRequest = {
        photoId: 'photo-123',
        themeId: 'barbarian',
        outputFormat: 'jpeg',
        originalImageUrl: 'https://example.com/photo.jpg'
      };

      const expectedResult: ProcessingResult = {
        id: 'process-123',
        status: 'processing',
        createdAt: new Date(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResult,
      } as Response);

      const result = await service.startProcessing(request);

      expect(mockFetch).toHaveBeenCalledWith('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(expectedResult);
    });

    it('should throw error on failed request', async () => {
      const request: ProcessingRequest = {
        photoId: 'photo-123',
        themeId: 'barbarian',
        outputFormat: 'jpeg',
        originalImageUrl: 'https://example.com/photo.jpg'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid request' }),
      } as Response);

      await expect(service.startProcessing(request)).rejects.toThrow('Invalid request');
    });
  });

  describe('getProcessingStatus', () => {
    it('should get processing status successfully', async () => {
      const expectedResult: ProcessingResult = {
        id: 'process-123',
        status: 'completed',
        resultUrl: 'https://example.com/result.jpg',
        processingTime: 5000,
        createdAt: new Date(),
        completedAt: new Date(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResult,
      } as Response);

      const result = await service.getProcessingStatus('process-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/process/process-123');
      expect(result).toEqual(expectedResult);
    });

    it('should throw error on failed status request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(service.getProcessingStatus('process-123')).rejects.toThrow(
        'Failed to get processing status: 404'
      );
    });
  });

  describe('pollProcessingStatus', () => {
    it('should poll until completion', async () => {
      const processingResult: ProcessingResult = {
        id: 'process-123',
        status: 'processing',
        createdAt: new Date(),
      };

      const completedResult: ProcessingResult = {
        id: 'process-123',
        status: 'completed',
        resultUrl: 'https://example.com/result.jpg',
        processingTime: 5000,
        createdAt: new Date(),
        completedAt: new Date(),
      };

      // First call returns processing, second returns completed
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => processingResult,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => completedResult,
        } as Response);

      const onProgress = vi.fn();
      const onStatusChange = vi.fn();

      const result = await service.pollProcessingStatus('process-123', {
        onProgress,
        onStatusChange,
      });

      expect(result).toEqual(completedResult);
      expect(onProgress).toHaveBeenCalled();
      expect(onStatusChange).toHaveBeenCalledWith('processing');
      expect(onStatusChange).toHaveBeenCalledWith('completed');
    });

    it('should handle cancellation', async () => {
      const abortController = new AbortController();
      
      // Cancel immediately
      abortController.abort();
      
      const pollPromise = service.pollProcessingStatus('process-123', {
        signal: abortController.signal,
      });

      await expect(pollPromise).rejects.toThrow('Processing cancelled');
    });

    it('should timeout after max processing time', async () => {
      // Mock Date.now to simulate time passing
      const originalDateNow = Date.now;
      let currentTime = originalDateNow();
      
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'process-123',
          status: 'processing',
          createdAt: new Date(currentTime),
        }),
      } as Response);

      const pollPromise = service.pollProcessingStatus('process-123');

      // Simulate time passing beyond timeout
      currentTime += 35000;

      await expect(pollPromise).rejects.toThrow('Processing timeout');
      
      vi.restoreAllMocks();
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress correctly', () => {
      // Access private method through any cast for testing
      const calculateProgress = (service as any).calculateProgress.bind(service);

      expect(calculateProgress('processing', 0)).toBe(0);
      expect(calculateProgress('processing', 7500)).toBe(45); // 7.5s out of 15s = 50%, capped at 90%
      expect(calculateProgress('processing', 15000)).toBe(90);
      expect(calculateProgress('completed', 10000)).toBe(100);
      expect(calculateProgress('failed', 10000)).toBe(0);
    });
  });

  describe('parseProcessingError', () => {
    it('should parse NO_FACE_DETECTED error correctly', () => {
      const error = service.parseProcessingError({ type: 'NO_FACE_DETECTED' });

      expect(error.type).toBe('NO_FACE_DETECTED');
      expect(error.retryable).toBe(true);
      expect(error.userMessage).toContain('couldn\'t detect a face');
      expect(error.suggestions).toContain('Make sure your face is clearly visible');
    });

    it('should parse THEME_NOT_FOUND error correctly', () => {
      const error = service.parseProcessingError({ type: 'THEME_NOT_FOUND' });

      expect(error.type).toBe('THEME_NOT_FOUND');
      expect(error.retryable).toBe(false);
      expect(error.userMessage).toContain('theme is not available');
    });

    it('should handle unknown error types', () => {
      const error = service.parseProcessingError({ type: 'UNKNOWN_ERROR_TYPE' });

      expect(error.type).toBe('INTERNAL_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.userMessage).toContain('Something went wrong');
    });

    it('should handle errors without type', () => {
      const error = service.parseProcessingError(new Error('Network error'));

      expect(error.type).toBe('INTERNAL_ERROR');
      expect(error.retryable).toBe(true);
    });
  });

  describe('cancelProcessing', () => {
    it('should attempt to cancel processing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await service.cancelProcessing('process-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/process/process-123/cancel', {
        method: 'POST',
      });
    });

    it('should handle cancellation errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect(service.cancelProcessing('process-123')).resolves.toBeUndefined();
    });
  });
});