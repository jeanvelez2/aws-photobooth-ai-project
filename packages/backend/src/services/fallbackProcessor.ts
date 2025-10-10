import { logger } from '../utils/logger.js';
import { ProcessingInput, ProcessingOptions } from './styleTransferEngine.js';
import { imageProcessingService } from './imageProcessingService.js';
import sharp from 'sharp';

export interface FallbackLevel {
  level: number;
  method: 'reduced_quality' | 'simplified_model' | 'basic_overlay';
  maxProcessingTime: number;
  expectedQuality: number;
  description: string;
}

export interface FallbackStrategy {
  primaryProcessing: string;
  fallbackLevels: FallbackLevel[];
  qualityThresholds: number[];
  timeoutLimits: number[];
}

/**
 * Fallback Processor
 * Provides alternative processing methods when advanced style transfer fails
 */
export class FallbackProcessor {
  private fallbackStrategy: FallbackStrategy;

  constructor() {
    this.fallbackStrategy = {
      primaryProcessing: 'advanced_style_transfer',
      fallbackLevels: [
        {
          level: 1,
          method: 'reduced_quality',
          maxProcessingTime: 15000, // 15 seconds
          expectedQuality: 0.8,
          description: 'Reduced quality style transfer with lower resolution'
        },
        {
          level: 2,
          method: 'simplified_model',
          maxProcessingTime: 10000, // 10 seconds
          expectedQuality: 0.6,
          description: 'Simplified neural network model with faster processing'
        },
        {
          level: 3,
          method: 'basic_overlay',
          maxProcessingTime: 5000, // 5 seconds
          expectedQuality: 0.4,
          description: 'Basic face overlay without advanced style transfer'
        }
      ],
      qualityThresholds: [0.8, 0.6, 0.4],
      timeoutLimits: [15000, 10000, 5000]
    };
  }

  /**
   * Process image using fallback methods
   */
  async process(input: ProcessingInput): Promise<Buffer> {
    logger.info('Starting fallback processing', {
      theme: input.theme,
      originalMethod: 'advanced_style_transfer'
    });

    // Try each fallback level in order
    for (const fallbackLevel of this.fallbackStrategy.fallbackLevels) {
      try {
        logger.info('Attempting fallback processing', {
          level: fallbackLevel.level,
          method: fallbackLevel.method,
          expectedQuality: fallbackLevel.expectedQuality
        });

        const result = await this.processFallbackLevel(input, fallbackLevel);
        
        logger.info('Fallback processing succeeded', {
          level: fallbackLevel.level,
          method: fallbackLevel.method
        });

        return result;

      } catch (error) {
        logger.warn('Fallback level failed', {
          level: fallbackLevel.level,
          method: fallbackLevel.method,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Continue to next fallback level
        continue;
      }
    }

    // If all fallback levels fail, throw error
    throw new Error('All fallback processing methods failed');
  }

  /**
   * Process using specific fallback level
   */
  private async processFallbackLevel(input: ProcessingInput, fallbackLevel: FallbackLevel): Promise<Buffer> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Fallback processing timeout')), fallbackLevel.maxProcessingTime);
    });

    const processing = this.executeProcessingMethod(input, fallbackLevel);

    return Promise.race([processing, timeout]);
  }

  /**
   * Execute specific processing method
   */
  private async executeProcessingMethod(input: ProcessingInput, fallbackLevel: FallbackLevel): Promise<Buffer> {
    switch (fallbackLevel.method) {
      case 'reduced_quality':
        return this.processReducedQuality(input);
      
      case 'simplified_model':
        return this.processSimplifiedModel(input);
      
      case 'basic_overlay':
        return this.processBasicOverlay(input);
      
      default:
        throw new Error(`Unknown fallback method: ${fallbackLevel.method}`);
    }
  }

  /**
   * Process with reduced quality settings
   */
  private async processReducedQuality(input: ProcessingInput): Promise<Buffer> {
    logger.debug('Processing with reduced quality');

    // Reduce image resolution for faster processing
    const reducedImage = await sharp(input.originalImage)
      .resize(512, 512, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    // Create reduced quality options
    const reducedOptions: ProcessingOptions = {
      ...input.processingOptions,
      quality: 'fast',
      styleIntensity: Math.max(0.1, input.processingOptions.styleIntensity * 0.7),
      enableAdvancedFeatures: false,
      targetWidth: 512,
      targetHeight: 512
    };

    // Use existing image processing service with reduced settings
    const processingInput = {
      ...input,
      originalImage: reducedImage,
      processingOptions: reducedOptions
    };

    // This would use a simplified version of the style transfer engine
    // For now, fall back to basic overlay
    return this.processBasicOverlay(processingInput);
  }

  /**
   * Process with simplified model
   */
  private async processSimplifiedModel(input: ProcessingInput): Promise<Buffer> {
    logger.debug('Processing with simplified model');

    // Use a lighter-weight processing approach
    // This would typically use a smaller, faster neural network model
    // For now, implement basic color and texture adjustments

    const face = input.faceData.faces[0];
    const imageMetadata = await sharp(input.originalImage).metadata();
    const width = imageMetadata.width || 1024;
    const height = imageMetadata.height || 1024;

    // Extract face region
    const faceX = Math.round(face.boundingBox.left * width);
    const faceY = Math.round(face.boundingBox.top * height);
    const faceWidth = Math.round(face.boundingBox.width * width);
    const faceHeight = Math.round(face.boundingBox.height * height);

    // Apply theme-specific color adjustments
    const themeAdjustments = this.getThemeAdjustments(input.theme);

    const processedImage = await sharp(input.originalImage)
      .modulate({
        brightness: themeAdjustments.brightness,
        saturation: themeAdjustments.saturation,
        hue: themeAdjustments.hue
      })
      .sharpen()
      .toBuffer();

    return processedImage;
  }

  /**
   * Process with basic overlay method
   */
  private async processBasicOverlay(input: ProcessingInput): Promise<Buffer> {
    logger.debug('Processing with basic overlay');

    try {
      // Use the existing image processing service for basic overlay
      // Note: This would need to upload the image to S3 first and get a key
      // For now, skip the image processing service and do basic processing
      // const result = await imageProcessingService.processImage(
      //   'temp-image-key', // This needs to be converted to S3 key or URL
      //   {
      //     themeId: input.theme,
      //     outputFormat: input.processingOptions.outputFormat || 'jpeg',
      //     quality: 75,
      //     generatePose: false
      //   }
      // );

      // Load the result image from S3
      // For now, return the original image with basic modifications
      const themeAdjustments = this.getThemeAdjustments(input.theme);

      return await sharp(input.originalImage)
        .modulate({
          brightness: themeAdjustments.brightness,
          saturation: themeAdjustments.saturation,
          hue: themeAdjustments.hue
        })
        .jpeg({ quality: 80 })
        .toBuffer();

    } catch (error) {
      logger.error('Basic overlay processing failed', { error });
      
      // Last resort: return original image with minimal processing
      return await sharp(input.originalImage)
        .jpeg({ quality: 85 })
        .toBuffer();
    }
  }

  /**
   * Get theme-specific adjustments for fallback processing
   */
  private getThemeAdjustments(theme: string): {
    brightness: number;
    saturation: number;
    hue: number;
    contrast: number;
  } {
    const adjustments = {
      barbarian: {
        brightness: 0.9,
        saturation: 1.2,
        hue: -5,
        contrast: 1.1
      },
      greek: {
        brightness: 1.1,
        saturation: 0.9,
        hue: 10,
        contrast: 1.05
      },
      mystic: {
        brightness: 0.95,
        saturation: 1.3,
        hue: 15,
        contrast: 1.15
      },
      anime: {
        brightness: 1.05,
        saturation: 1.4,
        hue: 0,
        contrast: 1.2
      }
    };

    return adjustments[theme as keyof typeof adjustments] || {
      brightness: 1.0,
      saturation: 1.0,
      hue: 0,
      contrast: 1.0
    };
  }

  /**
   * Get fallback strategy information
   */
  getFallbackStrategy(): FallbackStrategy {
    return { ...this.fallbackStrategy };
  }

  /**
   * Update fallback strategy
   */
  updateFallbackStrategy(strategy: Partial<FallbackStrategy>): void {
    this.fallbackStrategy = {
      ...this.fallbackStrategy,
      ...strategy
    };

    logger.info('Fallback strategy updated', {
      fallbackLevels: this.fallbackStrategy.fallbackLevels.length
    });
  }

  /**
   * Check if fallback is recommended for given error
   */
  shouldUseFallback(error: any, processingOptions: ProcessingOptions): boolean {
    const fallbackTriggers = [
      'INSUFFICIENT_GPU_MEMORY',
      'STYLE_TRANSFER_TIMEOUT',
      'MODEL_LOADING_FAILED',
      'PROCESSING_FAILED'
    ];

    const errorMessage = error?.message || error?.type || '';
    const shouldFallback = fallbackTriggers.some(trigger => 
      errorMessage.includes(trigger)
    );

    // Don't use fallback if advanced features are disabled
    if (!processingOptions.enableAdvancedFeatures) {
      return false;
    }

    return shouldFallback;
  }

  /**
   * Estimate processing time for fallback method
   */
  estimateProcessingTime(method: string): number {
    const fallbackLevel = this.fallbackStrategy.fallbackLevels.find(
      level => level.method === method
    );

    return fallbackLevel?.maxProcessingTime || 10000; // Default 10 seconds
  }

  /**
   * Get quality expectation for fallback method
   */
  getQualityExpectation(method: string): number {
    const fallbackLevel = this.fallbackStrategy.fallbackLevels.find(
      level => level.method === method
    );

    return fallbackLevel?.expectedQuality || 0.5; // Default 50% quality
  }
}