import sharp from 'sharp';
import { logger } from '../utils/logger.js';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  progressive?: boolean;
  stripMetadata?: boolean;
}

export interface OptimizationResult {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
  compressionRatio: number;
}

export class ImageOptimizationService {
  private static readonly DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
    maxWidth: 2400,
    maxHeight: 3200,
    quality: 85,
    format: 'jpeg',
    progressive: true,
    stripMetadata: true,
  };

  /**
   * Optimize an image buffer with specified options
   */
  async optimizeImage(
    inputBuffer: Buffer,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const opts = { ...ImageOptimizationService.DEFAULT_OPTIONS, ...options };
    
    try {
      const originalSize = inputBuffer.length;
      
      // Get image metadata
      const metadata = await sharp(inputBuffer).metadata();
      logger.info('Image optimization started', {
        originalWidth: metadata.width,
        originalHeight: metadata.height,
        originalFormat: metadata.format,
        originalSize,
        targetFormat: opts.format,
      });

      // Create sharp instance with input buffer
      let pipeline = sharp(inputBuffer);

      // Strip metadata if requested
      if (opts.stripMetadata) {
        pipeline = pipeline.withMetadata({
          exif: {},
          icc: undefined,
          // iptc: undefined, // Removed as not supported in newer Sharp versions
          // xmp: undefined, // Removed as not supported in newer Sharp versions
        });
      }

      // Resize if dimensions exceed limits
      const needsResize = 
        (metadata.width && metadata.width > opts.maxWidth) ||
        (metadata.height && metadata.height > opts.maxHeight);

      if (needsResize) {
        pipeline = pipeline.resize(opts.maxWidth, opts.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        });
      }

      // Apply format-specific optimizations
      switch (opts.format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({
            quality: opts.quality,
            progressive: opts.progressive,
            mozjpeg: true, // Use mozjpeg encoder for better compression
            trellisQuantisation: true,
            overshootDeringing: true,
            optimizeScans: true,
          });
          break;

        case 'png':
          pipeline = pipeline.png({
            quality: opts.quality,
            progressive: opts.progressive,
            compressionLevel: 9,
            adaptiveFiltering: true,
            palette: true, // Use palette when possible
          });
          break;

        case 'webp':
          pipeline = pipeline.webp({
            quality: opts.quality,
            effort: 6, // Higher effort for better compression
            smartSubsample: true,
          });
          break;

        case 'avif':
          pipeline = pipeline.avif({
            quality: opts.quality,
            effort: 9, // Maximum effort for best compression
            chromaSubsampling: '4:2:0',
          });
          break;
      }

      // Execute the pipeline
      const result = await pipeline.toBuffer({ resolveWithObject: true });
      const processingTime = Date.now() - startTime;
      const compressionRatio = originalSize / result.info.size;

      logger.info('Image optimization completed', {
        processingTime,
        originalSize,
        optimizedSize: result.info.size,
        compressionRatio: compressionRatio.toFixed(2),
        finalWidth: result.info.width,
        finalHeight: result.info.height,
        finalFormat: result.info.format,
      });

      return {
        buffer: result.data,
        format: result.info.format || opts.format,
        width: result.info.width || 0,
        height: result.info.height || 0,
        size: result.info.size,
        compressionRatio,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Image optimization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        options: opts,
      });
      throw new Error(`Image optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate multiple optimized versions of an image for different use cases
   */
  async generateVariants(
    inputBuffer: Buffer,
    variants: Array<{ name: string; options: ImageOptimizationOptions }>
  ): Promise<Record<string, OptimizationResult>> {
    const results: Record<string, OptimizationResult> = {};
    
    // Process variants in parallel for better performance
    const promises = variants.map(async (variant) => {
      const result = await this.optimizeImage(inputBuffer, variant.options);
      return { name: variant.name, result };
    });

    const variantResults = await Promise.all(promises);
    
    for (const { name, result } of variantResults) {
      results[name] = result;
    }

    return results;
  }

  /**
   * Create responsive image variants (thumbnail, medium, large)
   */
  async createResponsiveVariants(inputBuffer: Buffer): Promise<Record<string, OptimizationResult>> {
    return this.generateVariants(inputBuffer, [
      {
        name: 'thumbnail',
        options: {
          maxWidth: 300,
          maxHeight: 300,
          quality: 80,
          format: 'webp',
        },
      },
      {
        name: 'medium',
        options: {
          maxWidth: 800,
          maxHeight: 800,
          quality: 85,
          format: 'webp',
        },
      },
      {
        name: 'large',
        options: {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 90,
          format: 'jpeg',
          progressive: true,
        },
      },
      {
        name: 'original',
        options: {
          maxWidth: 2400,
          maxHeight: 3200,
          quality: 95,
          format: 'jpeg',
          progressive: true,
        },
      },
    ]);
  }

  /**
   * Optimize image for web delivery with automatic format selection
   */
  async optimizeForWeb(
    inputBuffer: Buffer,
    acceptHeader?: string
  ): Promise<OptimizationResult> {
    // Determine best format based on Accept header
    let format: 'avif' | 'webp' | 'jpeg' = 'jpeg';
    
    if (acceptHeader) {
      if (acceptHeader.includes('image/avif')) {
        format = 'avif';
      } else if (acceptHeader.includes('image/webp')) {
        format = 'webp';
      }
    }

    return this.optimizeImage(inputBuffer, {
      format,
      quality: format === 'avif' ? 75 : format === 'webp' ? 80 : 85,
      progressive: true,
      stripMetadata: true,
    });
  }

  /**
   * Validate image and get optimization recommendations
   */
  async analyzeImage(inputBuffer: Buffer): Promise<{
    metadata: sharp.Metadata;
    recommendations: string[];
    estimatedSavings: number;
  }> {
    const metadata = await sharp(inputBuffer).metadata();
    const recommendations: string[] = [];
    let estimatedSavings = 0;

    // Check if image is too large
    if (metadata.width && metadata.width > 2400) {
      recommendations.push(`Resize width from ${metadata.width}px to 2400px`);
      estimatedSavings += 0.3; // Estimate 30% savings
    }

    if (metadata.height && metadata.height > 3200) {
      recommendations.push(`Resize height from ${metadata.height}px to 3200px`);
      estimatedSavings += 0.3;
    }

    // Check format optimization
    if (metadata.format === 'png' && !metadata.hasAlpha) {
      recommendations.push('Convert PNG to JPEG for better compression');
      estimatedSavings += 0.5; // Estimate 50% savings
    }

    // Check for metadata
    if (metadata.exif || metadata.icc || metadata.iptc) {
      recommendations.push('Strip metadata to reduce file size');
      estimatedSavings += 0.05; // Estimate 5% savings
    }

    return {
      metadata,
      recommendations,
      estimatedSavings: Math.min(estimatedSavings, 0.8), // Cap at 80%
    };
  }
}

export const imageOptimizationService = new ImageOptimizationService();