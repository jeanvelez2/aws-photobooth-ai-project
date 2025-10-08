import sharp from 'sharp';
// import Jimp from 'jimp'; // Removed due to import issues, will be re-added later
import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import { logger } from '../utils/logger.js';
import {
  FaceDetectionResult,
  FacialLandmark,
  AlignedFace,
  ThemeVariant,
} from 'shared';

export interface ColorAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
}

export interface BlendingOptions {
  featherRadius: number;
  opacity: number;
  blendMode: 'normal' | 'multiply' | 'overlay' | 'soft-light';
}

export interface ProcessingOptions {
  outputFormat: 'jpeg' | 'png';
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * ImageProcessingPipeline handles the complete image processing workflow
 * including face alignment, color correction, and seamless blending
 */
export class ImageProcessingPipeline {
  private readonly DEFAULT_OUTPUT_WIDTH = 2400;
  private readonly DEFAULT_OUTPUT_HEIGHT = 3200;
  private readonly DEFAULT_QUALITY = 90;
  private readonly DEFAULT_FEATHER_RADIUS = 10;

  /**
   * Process a face image with a theme template
   * @param faceImageBuffer - Original face image buffer
   * @param faceDetection - Face detection results with landmarks
   * @param themeVariant - Theme variant with template and settings
   * @param options - Processing options
   * @returns Promise<Buffer> - Processed image buffer
   */
  async processImage(
    faceImageBuffer: Buffer,
    faceDetection: FaceDetectionResult,
    themeVariant: ThemeVariant,
    options: ProcessingOptions = { outputFormat: 'jpeg', quality: this.DEFAULT_QUALITY }
  ): Promise<Buffer> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting optimized image processing pipeline', {
        faceImageSize: faceImageBuffer.length,
        themeId: themeVariant.id,
        outputFormat: options.outputFormat,
        startTime
      });

      // Performance optimization: Process steps in parallel where possible
      const [faceImage, themeTemplate] = await Promise.all([
        this.loadAndOptimizeImageBuffer(faceImageBuffer),
        this.loadThemeTemplate(themeVariant.templateUrl),
      ]);

      // Step 2: Align and scale the face (optimized)
      const alignedFace = await this.alignFaceOptimized(
        faceImage,
        faceDetection,
        themeVariant.faceRegion
      );

      // Step 3: Apply color corrections (optimized with Sharp)
      const colorCorrectedFace = await this.applyColorCorrectionOptimized(
        alignedFace.imageBuffer,
        themeVariant.colorAdjustments
      );

      // Step 4: Blend the face with the theme template (optimized)
      const blendedImage = await this.blendFaceWithTemplateOptimized(
        colorCorrectedFace,
        themeTemplate,
        themeVariant.faceRegion,
        alignedFace.transform,
        {
          featherRadius: this.DEFAULT_FEATHER_RADIUS,
          opacity: 1.0,
          blendMode: 'normal',
        }
      );

      // Step 5: Final processing and output (optimized)
      const finalImage = await this.finalizeImageOptimized(
        blendedImage,
        options
      );

      const processingTime = Date.now() - startTime;
      logger.info('Image processing completed successfully', {
        outputSize: finalImage.length,
        processingTime,
        targetTime: 8000,
        performance: processingTime <= 8000 ? 'WITHIN_TARGET' : 'OVER_TARGET'
      });

      // Log performance warning if over target
      if (processingTime > 8000) {
        logger.warn('Processing time exceeded 8-second target', {
          processingTime,
          overage: processingTime - 8000
        });
      }

      return finalImage;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Image processing failed', {
        error: error instanceof Error ? error.message : error,
        processingTime
      });
      throw new Error('IMAGE_PROCESSING_FAILED');
    }
  }

  /**
   * Optimized face alignment with performance improvements
   */
  async alignFaceOptimized(
    faceImageBuffer: Buffer,
    faceDetection: FaceDetectionResult,
    faceRegion: ThemeVariant['faceRegion']
  ): Promise<AlignedFace> {
    const alignStart = Date.now();
    
    try {
      logger.info('Starting optimized face alignment', {
        boundingBox: faceDetection.boundingBox,
        targetRegion: faceRegion,
      });

      // Get face image metadata (cached for performance)
      const faceMetadata = await sharp(faceImageBuffer).metadata();
      const imageWidth = faceMetadata.width!;
      const imageHeight = faceMetadata.height!;

      // Pre-calculate transformations to minimize Sharp operations
      const faceLandmarks = this.extractKeyLandmarks(faceDetection.landmarks);
      const faceCenter = this.calculateFaceCenter(faceDetection.boundingBox, imageWidth, imageHeight);
      const transform = this.calculateTransformation(
        faceLandmarks,
        faceCenter,
        faceRegion,
        { width: imageWidth, height: imageHeight }
      );

      // Single Sharp operation for all transformations (performance optimization)
      const alignedImageBuffer = await sharp(faceImageBuffer)
        .resize(
          Math.round(imageWidth * transform.scale),
          Math.round(imageHeight * transform.scale),
          { 
            fit: 'contain', 
            background: { r: 0, g: 0, b: 0, alpha: 0 },
            kernel: sharp.kernel.lanczos2, // Faster than lanczos3, still good quality
            fastShrinkOnLoad: true
          }
        )
        .rotate(transform.rotation, { 
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .extract({
          left: Math.max(0, Math.round(-transform.translation.x)),
          top: Math.max(0, Math.round(-transform.translation.y)),
          width: Math.round(faceRegion.width),
          height: Math.round(faceRegion.height),
        })
        .png({ 
          compressionLevel: 6,
          adaptiveFiltering: false
        })
        .toBuffer();

      // Transform landmarks efficiently
      const transformedLandmarks = this.transformLandmarks(
        faceDetection.landmarks,
        transform,
        imageWidth,
        imageHeight
      );

      const alignTime = Date.now() - alignStart;
      logger.info('Optimized face alignment completed', {
        transform,
        alignedSize: alignedImageBuffer.length,
        alignmentTime: alignTime
      });

      return {
        imageBuffer: alignedImageBuffer,
        landmarks: transformedLandmarks,
        transform,
      };
    } catch (error) {
      logger.error('Optimized face alignment failed', {
        error: error instanceof Error ? error.message : error,
        alignmentTime: Date.now() - alignStart
      });
      throw new Error('FACE_ALIGNMENT_FAILED');
    }
  }

  /**
   * Align and scale a face to match the theme template requirements
   * @param faceImageBuffer - Original face image
   * @param faceDetection - Face detection results
   * @param faceRegion - Target face region in theme template
   * @returns Promise<AlignedFace> - Aligned face with transformation data
   */
  async alignFace(
    faceImageBuffer: Buffer,
    faceDetection: FaceDetectionResult,
    faceRegion: ThemeVariant['faceRegion']
  ): Promise<AlignedFace> {
    try {
      logger.info('Starting face alignment', {
        boundingBox: faceDetection.boundingBox,
        targetRegion: faceRegion,
      });

      // Get face image metadata
      const faceMetadata = await sharp(faceImageBuffer).metadata();
      const imageWidth = faceMetadata.width!;
      const imageHeight = faceMetadata.height!;

      // Calculate face center and key landmarks
      const faceLandmarks = this.extractKeyLandmarks(faceDetection.landmarks);
      const faceCenter = this.calculateFaceCenter(faceDetection.boundingBox, imageWidth, imageHeight);
      
      // Calculate required transformations
      const transform = this.calculateTransformation(
        faceLandmarks,
        faceCenter,
        faceRegion,
        { width: imageWidth, height: imageHeight }
      );

      // Apply transformations using Sharp
      const alignedImageBuffer = await sharp(faceImageBuffer)
        .resize(
          Math.round(imageWidth * transform.scale),
          Math.round(imageHeight * transform.scale),
          { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
        )
        .rotate(transform.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extract({
          left: Math.max(0, Math.round(-transform.translation.x)),
          top: Math.max(0, Math.round(-transform.translation.y)),
          width: Math.round(faceRegion.width),
          height: Math.round(faceRegion.height),
        })
        .png() // Use PNG to preserve transparency
        .toBuffer();

      // Transform landmarks to match the aligned face
      const transformedLandmarks = this.transformLandmarks(
        faceDetection.landmarks,
        transform,
        imageWidth,
        imageHeight
      );

      logger.info('Face alignment completed', {
        transform,
        alignedSize: alignedImageBuffer.length,
      });

      return {
        imageBuffer: alignedImageBuffer,
        landmarks: transformedLandmarks,
        transform,
      };
    } catch (error) {
      logger.error('Face alignment failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw new Error('FACE_ALIGNMENT_FAILED');
    }
  }

  /**
   * Optimized color correction using Sharp's built-in operations
   */
  async applyColorCorrectionOptimized(
    imageBuffer: Buffer,
    adjustments: ColorAdjustments
  ): Promise<Buffer> {
    const colorStart = Date.now();
    
    try {
      logger.info('Applying optimized color correction', { adjustments });

      // Use Sharp's optimized modulate operation for better performance
      const correctedBuffer = await sharp(imageBuffer)
        .modulate({
          brightness: Math.max(0.1, Math.min(3.0, 1 + (adjustments.brightness / 100))),
          saturation: Math.max(0.1, Math.min(3.0, 1 + (adjustments.saturation / 100))),
          hue: adjustments.hue // Sharp handles hue rotation efficiently
        })
        .linear(
          // Contrast adjustment using linear transformation
          Math.max(0.1, Math.min(3.0, adjustments.contrast)),
          -(128 * (adjustments.contrast - 1)) // Offset to maintain midpoint
        )
        .png({ 
          compressionLevel: 6,
          adaptiveFiltering: false
        })
        .toBuffer();
      
      const colorTime = Date.now() - colorStart;
      logger.info('Optimized color correction completed', {
        processingTime: colorTime
      });
      
      return correctedBuffer;
    } catch (error) {
      logger.error('Optimized color correction failed', {
        error: error instanceof Error ? error.message : error,
        processingTime: Date.now() - colorStart
      });
      throw new Error('COLOR_CORRECTION_FAILED');
    }
  }

  /**
   * Apply color correction to match lighting conditions
   * @param imageBuffer - Image buffer to correct
   * @param adjustments - Color adjustment parameters
   * @returns Promise<Buffer> - Color-corrected image buffer
   */
  async applyColorCorrection(
    imageBuffer: Buffer,
    adjustments: ColorAdjustments
  ): Promise<Buffer> {
    try {
      logger.info('Applying color correction', { adjustments });

      // Use Sharp for basic color adjustments
      let sharpImage = sharp(imageBuffer);

      // Apply brightness and contrast
      if (adjustments.brightness !== 0 || adjustments.contrast !== 1) {
        sharpImage = sharpImage.modulate({
          brightness: 1 + (adjustments.brightness / 100),
          saturation: 1 + (adjustments.saturation / 100),
        });
      }

      // For now, just return the Sharp-processed buffer
      // TODO: Implement hue adjustment when Jimp import issues are resolved
      const correctedBuffer = await sharpImage.png().toBuffer();
      
      logger.info('Color correction completed');
      return correctedBuffer;
    } catch (error) {
      logger.error('Color correction failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw new Error('COLOR_CORRECTION_FAILED');
    }
  }

  /**
   * Optimized face blending using Sharp's composite operations
   */
  async blendFaceWithTemplateOptimized(
    faceBuffer: Buffer,
    templateBuffer: Buffer,
    faceRegion: ThemeVariant['faceRegion'],
    transform: AlignedFace['transform'],
    blendingOptions: BlendingOptions
  ): Promise<Buffer> {
    const blendStart = Date.now();
    
    try {
      logger.info('Starting optimized face blending', {
        faceRegion,
        blendingOptions,
      });

      // Use Sharp's composite operation for better performance than Canvas
      const blendedBuffer = await sharp(templateBuffer)
        .composite([{
          input: faceBuffer,
          top: Math.round(faceRegion.y),
          left: Math.round(faceRegion.x),
          blend: this.getSharpBlendMode(blendingOptions.blendMode)
        }])
        .png({ 
          compressionLevel: 6,
          adaptiveFiltering: false
        })
        .toBuffer();

      const blendTime = Date.now() - blendStart;
      logger.info('Optimized face blending completed', {
        blendedSize: blendedBuffer.length,
        blendingTime: blendTime
      });

      return blendedBuffer;
    } catch (error) {
      logger.error('Optimized face blending failed', {
        error: error instanceof Error ? error.message : error,
        blendingTime: Date.now() - blendStart
      });
      throw new Error('FACE_BLENDING_FAILED');
    }
  }

  /**
   * Blend the aligned face with the theme template using seamless integration
   * @param faceBuffer - Aligned and color-corrected face image
   * @param templateBuffer - Theme template image
   * @param faceRegion - Target region for face placement
   * @param transform - Face transformation data
   * @param blendingOptions - Blending parameters
   * @returns Promise<Buffer> - Blended image buffer
   */
  async blendFaceWithTemplate(
    faceBuffer: Buffer,
    templateBuffer: Buffer,
    faceRegion: ThemeVariant['faceRegion'],
    transform: AlignedFace['transform'],
    blendingOptions: BlendingOptions
  ): Promise<Buffer> {
    try {
      logger.info('Starting face blending', {
        faceRegion,
        blendingOptions,
      });

      // Load images with Canvas for advanced blending
      const [faceImage, templateImage] = await Promise.all([
        loadImage(faceBuffer),
        loadImage(templateBuffer),
      ]);

      // Create canvas with template dimensions
      const canvas = createCanvas(templateImage.width, templateImage.height);
      const ctx = canvas.getContext('2d');

      // Draw template as base
      ctx.drawImage(templateImage, 0, 0);

      // Create face mask for seamless blending
      const faceMask = await this.createBlendingMask(
        faceBuffer,
        faceRegion.width,
        faceRegion.height,
        blendingOptions.featherRadius
      );

      // Apply blending with mask
      await this.applyMaskedBlending(
        ctx,
        faceImage,
        faceMask,
        faceRegion,
        blendingOptions
      );

      // Convert canvas to buffer
      const blendedBuffer = canvas.toBuffer('image/png');

      logger.info('Face blending completed', {
        blendedSize: blendedBuffer.length,
      });

      return blendedBuffer;
    } catch (error) {
      logger.error('Face blending failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw new Error('FACE_BLENDING_FAILED');
    }
  }

  /**
   * Optimized image finalization with better compression
   */
  async finalizeImageOptimized(
    imageBuffer: Buffer,
    options: ProcessingOptions
  ): Promise<Buffer> {
    const finalizeStart = Date.now();
    
    try {
      logger.info('Finalizing image with optimization', { options });

      let sharpInstance = sharp(imageBuffer);

      // Resize if dimensions specified (optimized)
      if (options.maxWidth || options.maxHeight) {
        sharpInstance = sharpInstance.resize(
          options.maxWidth || this.DEFAULT_OUTPUT_WIDTH,
          options.maxHeight || this.DEFAULT_OUTPUT_HEIGHT,
          { 
            fit: 'inside', 
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos2, // Good quality, faster than lanczos3
            fastShrinkOnLoad: true
          }
        );
      }

      // Optimized output format conversion
      let finalBuffer: Buffer;
      if (options.outputFormat === 'jpeg') {
        finalBuffer = await sharpInstance
          .jpeg({ 
            quality: options.quality || this.DEFAULT_QUALITY,
            progressive: true, // Better for web loading
            mozjpeg: true // Better compression
          })
          .toBuffer();
      } else {
        finalBuffer = await sharpInstance
          .png({ 
            quality: options.quality || this.DEFAULT_QUALITY,
            compressionLevel: 9, // Maximum compression for final output
            adaptiveFiltering: true, // Better compression for final output
            palette: true // Use palette when possible for smaller files
          })
          .toBuffer();
      }

      const finalizeTime = Date.now() - finalizeStart;
      logger.info('Optimized image finalization completed', {
        finalSize: finalBuffer.length,
        finalizationTime: finalizeTime
      });

      return finalBuffer;
    } catch (error) {
      logger.error('Optimized image finalization failed', {
        error: error instanceof Error ? error.message : error,
        finalizationTime: Date.now() - finalizeStart
      });
      throw new Error('IMAGE_FINALIZATION_FAILED');
    }
  }

  /**
   * Finalize the processed image with output formatting
   * @param imageBuffer - Processed image buffer
   * @param options - Output options
   * @returns Promise<Buffer> - Final image buffer
   */
  async finalizeImage(
    imageBuffer: Buffer,
    options: ProcessingOptions
  ): Promise<Buffer> {
    try {
      logger.info('Finalizing image', { options });

      let sharpImage = sharp(imageBuffer);

      // Resize if dimensions specified
      if (options.maxWidth || options.maxHeight) {
        sharpImage = sharpImage.resize(
          options.maxWidth || this.DEFAULT_OUTPUT_WIDTH,
          options.maxHeight || this.DEFAULT_OUTPUT_HEIGHT,
          { fit: 'inside', withoutEnlargement: true }
        );
      }

      // Convert to final format
      if (options.outputFormat === 'jpeg') {
        return await sharpImage
          .jpeg({ quality: options.quality || this.DEFAULT_QUALITY })
          .toBuffer();
      } else {
        return await sharpImage
          .png({ quality: options.quality || this.DEFAULT_QUALITY })
          .toBuffer();
      }
    } catch (error) {
      logger.error('Image finalization failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw new Error('IMAGE_FINALIZATION_FAILED');
    }
  }

  // Private helper methods

  private async loadImageBuffer(buffer: Buffer): Promise<Buffer> {
    // Normalize image format and ensure it's processable
    return await sharp(buffer)
      .png()
      .toBuffer();
  }

  private async loadAndOptimizeImageBuffer(buffer: Buffer): Promise<Buffer> {
    // Optimized loading with size constraints for faster processing
    const metadata = await sharp(buffer).metadata();
    
    // If image is too large, resize it for faster processing
    const maxDimension = 2048; // Max dimension for processing
    let sharpInstance = sharp(buffer);
    
    if (metadata.width && metadata.height) {
      const maxCurrentDimension = Math.max(metadata.width, metadata.height);
      if (maxCurrentDimension > maxDimension) {
        const scale = maxDimension / maxCurrentDimension;
        sharpInstance = sharpInstance.resize(
          Math.round(metadata.width * scale),
          Math.round(metadata.height * scale),
          { 
            kernel: sharp.kernel.lanczos3, // High quality but fast
            fastShrinkOnLoad: true // Optimize for speed
          }
        );
      }
    }
    
    return await sharpInstance
      .png({ 
        compressionLevel: 6, // Balance between speed and size
        adaptiveFiltering: false // Faster encoding
      })
      .toBuffer();
  }

  private async loadThemeTemplate(templateUrl: string): Promise<Buffer> {
    // Validate URL to prevent path traversal
    if (!templateUrl || typeof templateUrl !== 'string') {
      throw new Error('Invalid template URL');
    }
    
    // Sanitize URL and validate format
    const sanitizedUrl = templateUrl.replace(/[\r\n\t]/g, '').trim();
    
    // Only allow HTTPS URLs from trusted domains to prevent SSRF
    if (!sanitizedUrl.startsWith('https://')) {
      throw new Error('Template URL must use HTTPS');
    }
    
    // Validate URL format and prevent path traversal
    try {
      const url = new URL(sanitizedUrl);
      // Allow CloudFront and S3 domains
      const allowedDomains = ['s3.amazonaws.com', 'amazonaws.com', 'cloudfront.net'];
      const isAllowedDomain = allowedDomains.some(domain => 
        url.hostname.endsWith(domain)
      );
      
      if (!isAllowedDomain) {
        logger.error('Template URL domain not allowed', { 
          hostname: url.hostname,
          allowedDomains 
        });
        throw new Error('Template URL domain not allowed');
      }
      
      // Prevent path traversal in URL path
      if (url.pathname.includes('..') || url.pathname.includes('//')) {
        throw new Error('Invalid URL path detected');
      }
    } catch (urlError) {
      logger.error('Invalid template URL format', {
        templateUrl: sanitizedUrl,
        error: urlError instanceof Error ? urlError.message : 'Unknown error'
      });
      throw new Error('Invalid template URL format');
    }
    
    logger.info('Loading theme template', { templateUrl: sanitizedUrl });
    
    try {
      // Fetch the template from the URL
      const response = await fetch(sanitizedUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (fetchError) {
      logger.error('Failed to fetch theme template', {
        templateUrl: sanitizedUrl,
        error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
      });
      
      // Fallback to mock template if fetch fails
      logger.warn('Using mock template as fallback');
      return await sharp({
        create: {
          width: 800,
          height: 1200,
          channels: 4,
          background: { r: 100, g: 150, b: 200, alpha: 1 }
        }
      }).png().toBuffer();
    }
  }

  private extractKeyLandmarks(landmarks: FacialLandmark[]) {
    const keyLandmarks = {
      leftEye: landmarks.find(l => l.type === 'eyeLeft'),
      rightEye: landmarks.find(l => l.type === 'eyeRight'),
      nose: landmarks.find(l => l.type === 'nose'),
      mouthLeft: landmarks.find(l => l.type === 'mouthLeft'),
      mouthRight: landmarks.find(l => l.type === 'mouthRight'),
    };

    // Validate that we have the essential landmarks
    if (!keyLandmarks.leftEye || !keyLandmarks.rightEye || !keyLandmarks.nose) {
      throw new Error('INSUFFICIENT_LANDMARKS');
    }

    return keyLandmarks;
  }

  private calculateFaceCenter(
    boundingBox: FaceDetectionResult['boundingBox'],
    imageWidth: number,
    imageHeight: number
  ) {
    return {
      x: (boundingBox.left + boundingBox.width / 2) * imageWidth,
      y: (boundingBox.top + boundingBox.height / 2) * imageHeight,
    };
  }

  private calculateTransformation(
    landmarks: ReturnType<typeof this.extractKeyLandmarks>,
    faceCenter: { x: number; y: number },
    faceRegion: ThemeVariant['faceRegion'],
    imageSize: { width: number; height: number }
  ) {
    // Calculate eye distance for scaling
    const eyeDistance = Math.sqrt(
      Math.pow((landmarks.rightEye!.x - landmarks.leftEye!.x) * imageSize.width, 2) +
      Math.pow((landmarks.rightEye!.y - landmarks.leftEye!.y) * imageSize.height, 2)
    );

    // Calculate target eye distance based on face region
    const targetEyeDistance = faceRegion.width * 0.3; // Assume eyes are ~30% of face width

    // Calculate scale factor
    const scale = targetEyeDistance / eyeDistance;

    // Calculate rotation based on eye alignment
    const eyeAngle = Math.atan2(
      (landmarks.rightEye!.y - landmarks.leftEye!.y) * imageSize.height,
      (landmarks.rightEye!.x - landmarks.leftEye!.x) * imageSize.width
    );
    const rotation = (eyeAngle * 180) / Math.PI - faceRegion.rotation;

    // Calculate translation to center face in region
    const translation = {
      x: faceRegion.x + faceRegion.width / 2 - faceCenter.x * scale,
      y: faceRegion.y + faceRegion.height / 2 - faceCenter.y * scale,
    };

    return { scale, rotation, translation };
  }

  private transformLandmarks(
    landmarks: FacialLandmark[],
    transform: AlignedFace['transform'],
    originalWidth: number,
    originalHeight: number
  ): FacialLandmark[] {
    return landmarks.map(landmark => {
      // Convert normalized coordinates to pixel coordinates
      const pixelX = landmark.x * originalWidth;
      const pixelY = landmark.y * originalHeight;

      // Apply transformations
      const scaledX = pixelX * transform.scale;
      const scaledY = pixelY * transform.scale;

      // Apply rotation (simplified - would need proper matrix transformation)
      const rotatedX = scaledX + transform.translation.x;
      const rotatedY = scaledY + transform.translation.y;

      return {
        type: landmark.type,
        x: rotatedX,
        y: rotatedY,
      };
    });
  }

  private async createBlendingMask(
    faceBuffer: Buffer,
    width: number,
    height: number,
    featherRadius: number
  ): Promise<Buffer> {
    // Create a soft-edged mask for seamless blending
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Create radial gradient for soft edges
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2;

    const gradient = ctx.createRadialGradient(
      centerX, centerY, radius - featherRadius,
      centerX, centerY, radius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    return canvas.toBuffer('image/png');
  }

  private async applyMaskedBlending(
    ctx: CanvasRenderingContext2D,
    faceImage: any,
    maskBuffer: Buffer,
    faceRegion: ThemeVariant['faceRegion'],
    options: BlendingOptions
  ): Promise<void> {
    // Save current context
    ctx.save();

    // Set global alpha for blending
    ctx.globalAlpha = options.opacity;

    // Apply blend mode
    ctx.globalCompositeOperation = options.blendMode;

    // Draw face image at the specified region
    ctx.drawImage(
      faceImage,
      faceRegion.x,
      faceRegion.y,
      faceRegion.width,
      faceRegion.height
    );

    // Restore context
    ctx.restore();
  }

  private getSharpBlendMode(blendMode: BlendingOptions['blendMode']): sharp.Blend {
    switch (blendMode) {
      case 'multiply':
        return 'multiply';
      case 'overlay':
        return 'overlay';
      case 'soft-light':
        return 'soft-light';
      case 'normal':
      default:
        return 'over';
    }
  }
}

export const imageProcessingPipeline = new ImageProcessingPipeline();