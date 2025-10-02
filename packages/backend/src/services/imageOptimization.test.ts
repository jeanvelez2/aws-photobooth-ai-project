import { describe, it, expect, vi } from 'vitest';
import { ImageOptimizationService } from './imageOptimization.js';

// Mock sharp
vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
      hasAlpha: false,
      exif: {},
      icc: undefined,
      iptc: undefined,
    }),
    withMetadata: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    avif: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.from('optimized-image-data'),
      info: {
        format: 'jpeg',
        width: 1920,
        height: 1080,
        size: 50000,
      },
    }),
  }));

  (mockSharp as any).kernel = {
    lanczos3: 'lanczos3',
  };

  return { default: mockSharp };
});

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ImageOptimizationService', () => {
  let service: ImageOptimizationService;

  beforeEach(() => {
    service = new ImageOptimizationService();
    vi.clearAllMocks();
  });

  describe('Image Optimization', () => {
    it('should optimize an image with default settings', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      
      const result = await service.optimizeImage(inputBuffer);
      
      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('compressionRatio');
      
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.format).toBe('jpeg');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.size).toBe(50000);
    });

    it('should optimize image with custom options', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      const options = {
        maxWidth: 800,
        maxHeight: 600,
        quality: 75,
        format: 'webp' as const,
      };
      
      const result = await service.optimizeImage(inputBuffer, options);
      
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.format).toBe('jpeg'); // Mocked to return jpeg
    });

    it('should handle optimization errors gracefully', async () => {
      const inputBuffer = Buffer.from('invalid-image-data');
      
      // Mock sharp to throw an error
      const sharp = await import('sharp');
      vi.mocked(sharp.default).mockImplementationOnce(() => {
        throw new Error('Invalid image format');
      });
      
      await expect(service.optimizeImage(inputBuffer)).rejects.toThrow('Image optimization failed');
    });
  });

  describe('Variant Generation', () => {
    it('should generate multiple image variants', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      const variants = [
        { name: 'thumbnail', options: { maxWidth: 300, maxHeight: 300 } },
        { name: 'medium', options: { maxWidth: 800, maxHeight: 800 } },
      ];
      
      const results = await service.generateVariants(inputBuffer, variants);
      
      expect(results).toHaveProperty('thumbnail');
      expect(results).toHaveProperty('medium');
      expect(results.thumbnail?.buffer).toBeInstanceOf(Buffer);
      expect(results.medium?.buffer).toBeInstanceOf(Buffer);
    });

    it('should create responsive variants', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      
      const results = await service.createResponsiveVariants(inputBuffer);
      
      expect(results).toHaveProperty('thumbnail');
      expect(results).toHaveProperty('medium');
      expect(results).toHaveProperty('large');
      expect(results).toHaveProperty('original');
    });
  });

  describe('Web Optimization', () => {
    it('should optimize for web with AVIF support', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      const acceptHeader = 'image/avif,image/webp,image/*';
      
      const result = await service.optimizeForWeb(inputBuffer, acceptHeader);
      
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should optimize for web with WebP support', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      const acceptHeader = 'image/webp,image/*';
      
      const result = await service.optimizeForWeb(inputBuffer, acceptHeader);
      
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should fallback to JPEG for basic browsers', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      const acceptHeader = 'image/jpeg,image/*';
      
      const result = await service.optimizeForWeb(inputBuffer, acceptHeader);
      
      expect(result.buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('Image Analysis', () => {
    it('should analyze image and provide recommendations', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      
      const analysis = await service.analyzeImage(inputBuffer);
      
      expect(analysis).toHaveProperty('metadata');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('estimatedSavings');
      
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      expect(typeof analysis.estimatedSavings).toBe('number');
    });

    it('should recommend PNG to JPEG conversion for non-alpha images', async () => {
      const inputBuffer = Buffer.from('test-image-data');
      
      // Mock metadata to return PNG without alpha
      const sharp = await import('sharp');
      const mockInstance = vi.mocked(sharp.default).mockReturnValue({
        metadata: vi.fn().mockResolvedValue({
          width: 1920,
          height: 1080,
          format: 'png',
          hasAlpha: false,
        }),
      } as any);
      
      const analysis = await service.analyzeImage(inputBuffer);
      
      expect(analysis.recommendations.some(rec => 
        rec.includes('Convert PNG to JPEG')
      )).toBe(true);
    });
  });
});