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
      const faceDetection = await faceDetectionService.detectFaces(inputImageKey);
      console.log(`[IMAGE_PROCESSING] Face detection completed: ${faceDetection.faces.length} faces found`);
      
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
      const inputImageBuffer = await this.loadImageFromS3(inputImageKey);
      
      // Step 5: Load the theme template
      const themeTemplate = await this.loadThemeTemplate(options.themeId, selectedVariantId);
      
      // Step 5: Process the image (basic implementation)
      const processedImageBuffer = await this.blendImages(
        inputImageBuffer,
        themeTemplate,
        faceDetection,
        options
      );

      // Step 6: Optimize and save the result
      const optimizedBuffer = await performanceOptimizer.optimizeImage(processedImageBuffer, {
        quality: options.quality || 85,
        format: options.outputFormat === 'png' ? 'png' : 'jpeg'
      });
      
      const resultImageKey = `processed/${uuidv4()}.${options.outputFormat}`;
      await this.saveImageToS3(resultImageKey, optimizedBuffer, options.outputFormat);
      
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
      templateKeys.push(`themes/${themeId}/${variantId}-template.jpg`);
    }
    templateKeys.push(`themes/${themeId}/${themeId}-template.jpg`);
    
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

      // Extract and prepare face with padding for better blending
      const padding = Math.round(Math.max(faceWidth, faceHeight) * 0.3);
      const expandedX = Math.max(0, faceX - padding);
      const expandedY = Math.max(0, faceY - padding);
      const expandedWidth = Math.min(inputWidth - expandedX, faceWidth + (2 * padding));
      const expandedHeight = Math.min(inputHeight - expandedY, faceHeight + (2 * padding));
      
      const faceImage = await sharp(inputImage)
        .extract({ 
          left: expandedX, 
          top: expandedY, 
          width: expandedWidth, 
          height: expandedHeight 
        })
        .resize(300, 300, { fit: 'cover', position: 'center' })
        .toBuffer();

      // Get theme template metadata
      const themeMetadata = await sharp(themeTemplate).metadata();
      const themeWidth = themeMetadata.width || 1024;
      const themeHeight = themeMetadata.height || 1024;
      
      // Position face in center of theme (can be customized per theme later)
      const centerX = Math.round((themeWidth - 300) / 2);
      const centerY = Math.round((themeHeight - 300) / 2.5); // Slightly higher than center
      
      console.log(`[IMAGE_PROCESSING] Compositing face at ${centerX},${centerY} on ${themeWidth}x${themeHeight} theme`);

      // Composite face onto theme template
      const result = await sharp(themeTemplate)
        .resize(1024, 1024, { fit: 'cover' })
        .composite([{
          input: faceImage,
          left: centerX,
          top: centerY,
          blend: 'over'
        }])
        .jpeg({ quality: options.quality || 90 })
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