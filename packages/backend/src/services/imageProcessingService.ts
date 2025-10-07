import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { logger } from '../utils/logger.js';
import { performanceOptimizer } from './performanceOptimizer.js';
import { faceDetectionService, FaceDetectionResult } from './faceDetectionService.js';
import { genderAdaptiveThemeService } from './genderAdaptiveThemeService.js';
import { v4 as uuidv4 } from 'uuid';
import { config, getPublicImageUrl } from '../config/index.js';

export interface ProcessingOptions {
  themeId: string;
  variantId?: string;
  outputFormat: 'jpeg' | 'png';
  quality?: number;
}

export interface ProcessingResult {
  resultImageKey: string;
  resultImageUrl: string;
  processingTimeMs: number;
  faceCount: number;
  genderDetection?: {
    detectedGender: 'Male' | 'Female';
    confidence: number;
    recommendedVariant: string;
    reason: string;
  };
}

export class ImageProcessingService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({ region: config.aws.region });
    this.bucketName = config.aws.s3.bucketName;
    console.log(`[IMAGE_PROCESSING] Initialized with bucket: ${this.bucketName}, region: ${config.aws.region}`);
  }

  private extractS3KeyFromUrl(urlOrKey: string): string {
    // If it's already an S3 key (no protocol), return as-is
    if (!urlOrKey.startsWith('http')) {
      return urlOrKey;
    }

    try {
      const url = new URL(urlOrKey);
      
      // Handle CloudFront URLs
      if (url.hostname.includes('cloudfront.net')) {
        return url.pathname.substring(1); // Remove leading slash
      }
      
      // Handle direct S3 URLs
      if (url.hostname.includes('s3.amazonaws.com')) {
        return url.pathname.substring(1); // Remove leading slash
      }
      
      // Handle S3 bucket URLs (bucket.s3.region.amazonaws.com)
      if (url.hostname.includes('.s3.') && url.hostname.includes('.amazonaws.com')) {
        return url.pathname.substring(1); // Remove leading slash
      }
      
      throw new Error(`Unsupported URL format: ${urlOrKey}`);
    } catch (error) {
      throw new Error(`Unable to extract S3 key from URL: ${urlOrKey}`);
    }
  }

  async processImage(
    inputImageKeyOrUrl: string,
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    const inputImageKey = this.extractS3KeyFromUrl(inputImageKeyOrUrl);
    const startTime = Date.now();
    console.log(`[IMAGE_PROCESSING] Starting image processing for ${inputImageKey} with options:`, options);
    
    try {
      logger.info('Starting image processing', { inputImageKey, options });

      console.log(`[IMAGE_PROCESSING] Step 1: Detecting faces in ${inputImageKey}`);
      // Step 1: Detect faces in the input image
      let faceDetection;
      try {
        faceDetection = await faceDetectionService.detectFaces(inputImageKey);
        console.log(`[IMAGE_PROCESSING] Face detection completed: ${faceDetection.faces.length} faces found`);
      } catch (faceError) {
        console.log(`[IMAGE_PROCESSING] Face detection failed:`, faceError);
        throw faceError;
      }
      
      if (faceDetection.faces.length === 0) {
        throw new Error('NO_FACE_DETECTED');
      }

      // Step 2: Validate the primary face
      const primaryFace = faceDetection.faces[0];
      const faceValidation = faceDetectionService.validateFaceForProcessing(primaryFace);
      
      if (!faceValidation.valid) {
        throw new Error(`INVALID_FACE: ${faceValidation.reason}`);
      }

      // Step 3: Auto-select variant based on gender if not specified
      let selectedVariantId = options.variantId;
      let genderDetection;
      
      if (!selectedVariantId) {
        const genderSelection = await genderAdaptiveThemeService.selectVariantByGender(
          options.themeId, 
          faceDetection
        );
        selectedVariantId = genderSelection.recommendedVariantId;
        
        genderDetection = {
          detectedGender: primaryFace.gender.value,
          confidence: primaryFace.gender.confidence,
          recommendedVariant: selectedVariantId,
          reason: genderSelection.reason,
        };
        
        logger.info('Auto-selected variant based on gender', {
          inputImageKey,
          detectedGender: primaryFace.gender.value,
          confidence: primaryFace.gender.confidence,
          selectedVariantId,
        });
      }
      
      // Step 4: Load the input image
      console.log(`[IMAGE_PROCESSING] Step 4: Loading input image from S3`);
      const inputImageBuffer = await this.loadImageFromS3(inputImageKey);
      console.log(`[IMAGE_PROCESSING] Input image loaded, size: ${inputImageBuffer.length} bytes`);
      
      // Step 5: Load the theme template
      console.log(`[IMAGE_PROCESSING] Step 5: Loading theme template for ${options.themeId}/${selectedVariantId}`);
      const themeTemplate = await this.loadThemeTemplate(options.themeId, selectedVariantId);
      console.log(`[IMAGE_PROCESSING] Theme template loaded, size: ${themeTemplate.length} bytes`);
      
      // Step 6: Process the image (blend face with theme)
      console.log(`[IMAGE_PROCESSING] Step 6: Blending face with theme`);
      const processedImageBuffer = await this.blendImages(
        inputImageBuffer,
        themeTemplate,
        faceDetection,
        options
      );
      console.log(`[IMAGE_PROCESSING] Image blending completed, result size: ${processedImageBuffer.length} bytes`);

      // Step 7: Optimize and save the result
      console.log(`[IMAGE_PROCESSING] Step 7: Optimizing processed image`);
      const optimizedBuffer = await performanceOptimizer.optimizeImage(processedImageBuffer, {
        quality: options.quality || 85,
        format: options.outputFormat === 'png' ? 'png' : 'jpeg'
      });
      console.log(`[IMAGE_PROCESSING] Image optimized, final size: ${optimizedBuffer.length} bytes`);
      
      const resultImageKey = `processed/${uuidv4()}.${options.outputFormat}`;
      console.log(`[IMAGE_PROCESSING] Step 8: Saving result to S3 as ${resultImageKey}`);
      await this.saveImageToS3(resultImageKey, optimizedBuffer, options.outputFormat);
      console.log(`[IMAGE_PROCESSING] Result saved to S3 successfully`);
      
      // Optimize memory usage
      performanceOptimizer.optimizeMemory();

      const processingTimeMs = Date.now() - startTime;

      logger.info('Image processing completed', {
        inputImageKey,
        resultImageKey,
        processingTimeMs,
        faceCount: faceDetection.faces.length,
      });

      return {
        resultImageKey,
        resultImageUrl: getPublicImageUrl(resultImageKey),
        processingTimeMs,
        faceCount: faceDetection.faces.length,
        genderDetection,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      console.log(`[IMAGE_PROCESSING] Image processing failed for ${inputImageKey}:`, error);
      logger.error('Image processing failed', {
        inputImageKey,
        options,
        processingTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async loadImageFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Failed to load image from S3');
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  private async loadThemeTemplate(themeId: string, variantId?: string): Promise<Buffer> {
    // Try variant-specific template first, then fallback to base theme
    const templateKeys = [];
    
    if (variantId) {
      // Try template first, then thumb, then mask as fallbacks
      templateKeys.push(`themes/${themeId}/${variantId}-template.jpg`);
      templateKeys.push(`themes/${themeId}/${variantId}-thumb.jpg`);
      templateKeys.push(`themes/${themeId}/${variantId}-mask.png`);
    }
    // Base theme fallbacks
    templateKeys.push(`themes/${themeId}/${themeId}-template.jpg`);
    templateKeys.push(`themes/${themeId}/${themeId}-thumb.svg`); // Base themes use SVG thumbs
    
    console.log(`[IMAGE_PROCESSING] Looking for theme templates:`, templateKeys);
    
    for (const templateKey of templateKeys) {
      try {
        console.log(`[IMAGE_PROCESSING] Trying to load: ${templateKey}`);
        const template = await this.loadImageFromS3(templateKey);
        console.log(`[IMAGE_PROCESSING] Successfully loaded: ${templateKey}`);
        return template;
      } catch (error) {
        console.log(`[IMAGE_PROCESSING] Failed to load ${templateKey}:`, error.message);
        continue;
      }
    }
    
    logger.warn('No theme template found, using placeholder', { themeId, variantId, triedKeys: templateKeys });
    
    // Create a themed placeholder based on theme
    const themeColors = {
      anime: { r: 255, g: 182, b: 193 }, // Pink
      barbarian: { r: 139, g: 69, b: 19 }, // Brown
      greek: { r: 255, g: 215, b: 0 }, // Gold
      mystic: { r: 138, g: 43, b: 226 } // Purple
    };
    
    const color = themeColors[themeId as keyof typeof themeColors] || { r: 100, g: 150, b: 200 };
    
    return await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: color
      }
    }).jpeg().toBuffer();
  }

  private async blendImages(
    inputImage: Buffer,
    themeTemplate: Buffer,
    faceDetection: FaceDetectionResult,
    options: ProcessingOptions
  ): Promise<Buffer> {
    try {
      const face = faceDetection.faces[0];
      
      // Get input image metadata
      const inputMetadata = await sharp(inputImage).metadata();
      const inputWidth = inputMetadata.width || 1024;
      const inputHeight = inputMetadata.height || 1024;
      
      // Calculate face region with proper bounds checking
      const faceX = Math.max(0, Math.round(face.boundingBox.left * inputWidth));
      const faceY = Math.max(0, Math.round(face.boundingBox.top * inputHeight));
      const faceWidth = Math.min(inputWidth - faceX, Math.round(face.boundingBox.width * inputWidth));
      const faceHeight = Math.min(inputHeight - faceY, Math.round(face.boundingBox.height * inputHeight));
      
      console.log(`[IMAGE_PROCESSING] Face region: ${faceX},${faceY} ${faceWidth}x${faceHeight} from ${inputWidth}x${inputHeight}`);
      
      // Validate face region
      if (faceWidth <= 0 || faceHeight <= 0) {
        throw new Error('Invalid face region detected');
      }

      // Extract face with generous padding for seamless blending
      const padding = Math.round(Math.max(faceWidth, faceHeight) * 0.5);
      const expandedX = Math.max(0, faceX - padding);
      const expandedY = Math.max(0, faceY - padding);
      const expandedWidth = Math.min(inputWidth - expandedX, faceWidth + (2 * padding));
      const expandedHeight = Math.min(inputHeight - expandedY, faceHeight + (2 * padding));
      
      // Extract face with surrounding area for better blending
      const faceWithContext = await sharp(inputImage)
        .extract({ 
          left: expandedX, 
          top: expandedY, 
          width: expandedWidth, 
          height: expandedHeight 
        })
        .toBuffer();

      // Create a feathered mask for seamless blending
      const maskSize = Math.max(expandedWidth, expandedHeight);
      const featherRadius = Math.round(maskSize * 0.15);
      
      const mask = await sharp({
        create: {
          width: maskSize,
          height: maskSize,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
      .composite([{
        input: Buffer.from(
          `<svg width="${maskSize}" height="${maskSize}">
            <defs>
              <radialGradient id="fade" cx="50%" cy="50%" r="45%">
                <stop offset="0%" stop-color="white" stop-opacity="1"/>
                <stop offset="70%" stop-color="white" stop-opacity="0.8"/>
                <stop offset="100%" stop-color="white" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <ellipse cx="50%" cy="50%" rx="45%" ry="45%" fill="url(#fade)"/>
          </svg>`
        ),
        blend: 'over'
      }])
      .png()
      .toBuffer();

      // Resize face and mask to target size
      const targetSize = 350;
      const processedFace = await sharp(faceWithContext)
        .resize(targetSize, targetSize, { fit: 'cover', position: 'center' })
        .modulate({ brightness: 1.1, saturation: 1.05 }) // Slight enhancement
        .toBuffer();

      const processedMask = await sharp(mask)
        .resize(targetSize, targetSize, { fit: 'cover' })
        .toBuffer();

      // Get theme template metadata and prepare base
      const themeMetadata = await sharp(themeTemplate).metadata();
      const themeWidth = themeMetadata.width || 1024;
      const themeHeight = themeMetadata.height || 1024;
      
      const baseTheme = await sharp(themeTemplate)
        .resize(1024, 1024, { fit: 'cover' })
        .modulate({ brightness: 0.95, saturation: 1.1 }) // Enhance theme colors
        .toBuffer();
      
      // Position face strategically based on theme
      const centerX = Math.round((1024 - targetSize) / 2);
      const centerY = Math.round((1024 - targetSize) / 2.2); // Slightly higher
      
      console.log(`[IMAGE_PROCESSING] Blending face at ${centerX},${centerY} with feathered edges`);

      // Create seamless composite with feathered blending
      const result = await sharp(baseTheme)
        .composite([
          {
            input: processedFace,
            left: centerX,
            top: centerY,
            blend: 'multiply' // Blend colors naturally
          },
          {
            input: processedFace,
            left: centerX,
            top: centerY,
            blend: 'overlay', // Add depth and contrast
            premultiplied: true
          }
        ])
        .sharpen({ sigma: 0.5, m1: 0.5, m2: 2 }) // Subtle sharpening
        .jpeg({ quality: options.quality || 92, progressive: true })
        .toBuffer();

      return result;
    } catch (error) {
      logger.error('Image blending failed', { error });
      throw new Error('IMAGE_PROCESSING_FAILED');
    }
  }

  private async saveImageToS3(key: string, imageBuffer: Buffer, format: string): Promise<void> {
    const contentType = format === 'png' ? 'image/png' : 'image/jpeg';
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
      Metadata: {
        processedAt: new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);
  }

  async getProcessingCapabilities(): Promise<{
    supportedFormats: string[];
    maxImageSize: number;
    availableThemes: string[];
  }> {
    return {
      supportedFormats: ['jpeg', 'png', 'webp'],
      maxImageSize: 10 * 1024 * 1024, // 10MB
      availableThemes: ['anime', 'barbarian', 'greek', 'mystic'],
    };
  }
}

export const imageProcessingService = new ImageProcessingService();