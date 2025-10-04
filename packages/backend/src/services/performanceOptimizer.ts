import sharp from 'sharp';
import { logger } from '../utils/logger.js';

export class PerformanceOptimizer {
  // Image optimization with format conversion
  async optimizeImage(buffer: Buffer, options: {
    quality?: number;
    format?: 'jpeg' | 'webp' | 'png';
    maxWidth?: number;
    maxHeight?: number;
  } = {}): Promise<Buffer> {
    const {
      quality = 85,
      format = 'jpeg',
      maxWidth = 1920,
      maxHeight = 1080
    } = options;

    try {
      let pipeline = sharp(buffer)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });

      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality, progressive: true });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
        case 'png':
          pipeline = pipeline.png({ compressionLevel: 9 });
          break;
      }

      return await pipeline.toBuffer();
    } catch (error) {
      logger.error('Image optimization failed:', error);
      return buffer; // Return original if optimization fails
    }
  }

  // Generate responsive image variants
  async generateResponsiveImages(buffer: Buffer): Promise<{
    thumbnail: Buffer;
    medium: Buffer;
    large: Buffer;
  }> {
    const [thumbnail, medium, large] = await Promise.all([
      this.optimizeImage(buffer, { maxWidth: 300, maxHeight: 200, quality: 70 }),
      this.optimizeImage(buffer, { maxWidth: 800, maxHeight: 600, quality: 80 }),
      this.optimizeImage(buffer, { maxWidth: 1920, maxHeight: 1080, quality: 85 })
    ]);

    return { thumbnail, medium, large };
  }

  // Memory usage optimization
  getMemoryUsage(): { used: number; total: number; percentage: number } {
    const usage = process.memoryUsage();
    const total = usage.heapTotal;
    const used = usage.heapUsed;
    
    return {
      used: Math.round(used / 1024 / 1024), // MB
      total: Math.round(total / 1024 / 1024), // MB
      percentage: Math.round((used / total) * 100)
    };
  }

  // Force garbage collection if memory usage is high
  optimizeMemory(): void {
    const memory = this.getMemoryUsage();
    
    if (memory.percentage > 80) {
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection due to high memory usage');
      }
    }
  }
}

export const performanceOptimizer = new PerformanceOptimizer();