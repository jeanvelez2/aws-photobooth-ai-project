/**
 * Graceful Degradation Service Tests
 * Tests for service failure handling and fallback functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GracefulDegradationService } from './gracefulDegradation';

// Mock fetch
global.fetch = vi.fn();

describe('GracefulDegradationService', () => {
  let service: GracefulDegradationService;

  beforeEach(() => {
    service = new GracefulDegradationService({
      checkInterval: 1000,
      maxFailures: 3,
      fallbackTimeout: 2000,
      services: ['processing', 'upload', 'themes'],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('service status management', () => {
    it('should initialize services as available', () => {
      expect(service.isServiceAvailable('processing')).toBe(true);
      expect(service.isServiceAvailable('upload')).toBe(true);
      expect(service.isServiceAvailable('themes')).toBe(true);
    });

    it('should mark service as failed', () => {
      service.markServiceFailed('processing', 'Connection timeout');
      
      expect(service.isServiceAvailable('processing')).toBe(false);
      
      const status = service.getServiceStatus();
      const processingStatus = status.find(s => s.name === 'processing');
      expect(processingStatus?.available).toBe(false);
      expect(processingStatus?.error).toBe('Connection timeout');
    });

    it('should mark service as recovered', () => {
      service.markServiceFailed('processing');
      expect(service.isServiceAvailable('processing')).toBe(false);
      
      service.markServiceRecovered('processing');
      expect(service.isServiceAvailable('processing')).toBe(true);
    });
  });

  describe('executeWithFallback', () => {
    it('should execute primary function when service is available', async () => {
      const primaryFn = vi.fn().mockResolvedValue('primary result');
      const fallbackFn = vi.fn().mockResolvedValue('fallback result');
      
      const result = await service.executeWithFallback('processing', primaryFn, fallbackFn);
      
      expect(result).toBe('primary result');
      expect(primaryFn).toHaveBeenCalled();
      expect(fallbackFn).not.toHaveBeenCalled();
    });

    it('should execute fallback when primary fails', async () => {
      const primaryFn = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallbackFn = vi.fn().mockResolvedValue('fallback result');
      
      const result = await service.executeWithFallback('processing', primaryFn, fallbackFn);
      
      expect(result).toBe('fallback result');
      expect(primaryFn).toHaveBeenCalled();
      expect(fallbackFn).toHaveBeenCalled();
      expect(service.isServiceAvailable('processing')).toBe(false);
    });

    it('should throw error when both primary and fallback fail', async () => {
      const primaryFn = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallbackFn = vi.fn().mockRejectedValue(new Error('Fallback failed'));
      
      await expect(
        service.executeWithFallback('processing', primaryFn, fallbackFn)
      ).rejects.toThrow();
      
      expect(service.isServiceAvailable('processing')).toBe(false);
    });

    it('should recover service when primary succeeds after failure', async () => {
      // First, mark service as failed
      service.markServiceFailed('processing');
      expect(service.isServiceAvailable('processing')).toBe(false);
      
      // Then execute successfully
      const primaryFn = vi.fn().mockResolvedValue('success');
      await service.executeWithFallback('processing', primaryFn);
      
      expect(service.isServiceAvailable('processing')).toBe(true);
    });
  });

  describe('fallback functionality', () => {
    it('should provide processing fallbacks', () => {
      const fallbacks = service.getProcessingFallbacks();
      
      expect(fallbacks.basicProcessing).toBeDefined();
      expect(fallbacks.cachedResults).toBeDefined();
      expect(fallbacks.queueForLater).toBeDefined();
    });

    it('should provide theme fallbacks', () => {
      const fallbacks = service.getThemeFallbacks();
      
      expect(fallbacks.basicThemes).toBeDefined();
      expect(fallbacks.cachedThemes).toBeDefined();
    });

    it('should provide upload fallbacks', () => {
      const fallbacks = service.getUploadFallbacks();
      
      expect(fallbacks.localStorage).toBeDefined();
      expect(fallbacks.indexedDB).toBeDefined();
    });

    it('should queue processing requests for later', async () => {
      const fallbacks = service.getProcessingFallbacks();
      const request = { photoId: 'test', themeId: 'theme1' };
      
      const result = await fallbacks.queueForLater(request);
      
      expect(result.queued).toBe(true);
      expect(result.position).toBe(1);
      
      const queue = JSON.parse(localStorage.getItem('processing_queue') || '[]');
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject(request);
    });

    it('should provide basic themes when service fails', async () => {
      const fallbacks = service.getThemeFallbacks();
      const themes = await fallbacks.basicThemes();
      
      expect(themes).toHaveLength(2);
      expect(themes[0]).toMatchObject({
        id: 'basic-1',
        name: 'Classic',
      });
    });

    it('should store images in localStorage for small files', async () => {
      const fallbacks = service.getUploadFallbacks();
      const smallBlob = new Blob(['small image data'], { type: 'image/jpeg' });
      
      const result = await fallbacks.localStorage(smallBlob);
      
      expect(result.id).toMatch(/^local_\d+$/);
      expect(result.url).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('should reject large images for localStorage', async () => {
      const fallbacks = service.getUploadFallbacks();
      const largeBlob = new Blob([new ArrayBuffer(2 * 1024 * 1024)], { type: 'image/jpeg' }); // 2MB
      
      await expect(fallbacks.localStorage(largeBlob)).rejects.toThrow('Image too large for local storage');
    });
  });

  describe('service monitoring', () => {
    it('should track degraded services', () => {
      service.markServiceFailed('processing');
      service.markServiceFailed('upload');
      
      const degradedServices = service.getDegradedServices();
      expect(degradedServices).toHaveLength(2);
      expect(degradedServices.map(s => s.name)).toContain('processing');
      expect(degradedServices.map(s => s.name)).toContain('upload');
    });

    it('should detect service degradation', () => {
      expect(service.hasServiceDegradation()).toBe(false);
      
      service.markServiceFailed('processing');
      expect(service.hasServiceDegradation()).toBe(true);
      
      service.markServiceRecovered('processing');
      expect(service.hasServiceDegradation()).toBe(false);
    });

    it('should provide service status overview', () => {
      service.markServiceFailed('processing', 'Test error');
      
      const status = service.getServiceStatus();
      expect(status).toHaveLength(3);
      
      const processingStatus = status.find(s => s.name === 'processing');
      expect(processingStatus).toMatchObject({
        name: 'processing',
        available: false,
        error: 'Test error',
        fallbackAvailable: true,
      });
    });
  });

  describe('basic image processing', () => {
    it('should perform basic client-side processing', async () => {
      // Mock canvas and image APIs
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          fillRect: vi.fn(),
          globalAlpha: 0,
          fillStyle: '',
        }),
        toBlob: vi.fn((callback) => {
          // Immediately call the callback with a mock blob
          setTimeout(() => callback(new Blob(['processed'], { type: 'image/jpeg' })), 0);
        }),
      };
      
      const mockImage = {
        onload: null as any,
        onerror: null as any,
        src: '',
        width: 100,
        height: 100,
      };
      
      // Mock DOM APIs
      vi.stubGlobal('document', {
        createElement: vi.fn((tag) => {
          if (tag === 'canvas') return mockCanvas;
          if (tag === 'img') return mockImage;
        }),
      });
      
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn().mockReturnValue('blob:url'),
      });
      
      const fallbacks = service.getProcessingFallbacks();
      const imageBlob = new Blob(['image data'], { type: 'image/jpeg' });
      
      // Trigger the processing
      const processingPromise = fallbacks.basicProcessing(imageBlob, 'barbarian');
      
      // Simulate image load immediately
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 10);
      
      const result = await processingPromise;
      expect(result).toBeInstanceOf(Blob);
    }, 10000); // Increase timeout to 10 seconds
  });
});