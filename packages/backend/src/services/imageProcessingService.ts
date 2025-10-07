import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { logger } from '../utils/logger.js';
import { performanceOptimizer } from './performanceOptimizer.js';
import { faceDetectionService, FaceDetectionResult } from './faceDetectionService.js';
import { genderAdaptiveThemeService } from './genderAdaptiveThemeService.js';
import { bedrockService } from './bedrockService.js';
import { v4 as uuidv4 } from 'uuid';
import { config, getPublicImageUrl } from '../config/index.js';

export interface ProcessingOptions {
  themeId: string;
  variantId?: string;
  outputFormat: 'jpeg' | 'png';
  quality?: number;
  action?: string;
  mood?: string;
  generatePose?: boolean;
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
      
      // Step 5: Generate dynamic pose if requested
      let themeTemplate;
      if (options.generatePose && options.action) {
        console.log(`[IMAGE_PROCESSING] Step 5a: Generating dynamic pose with Bedrock`);
        const userFaceBuffer = await sharp(inputImageBuffer)
          .extract({
            left: Math.max(0, Math.round(primaryFace.boundingBox.left * (await sharp(inputImageBuffer).metadata()).width!)),
            top: Math.max(0, Math.round(primaryFace.boundingBox.top * (await sharp(inputImageBuffer).metadata()).height!)),
            width: Math.round(primaryFace.boundingBox.width * (await sharp(inputImageBuffer).metadata()).width!),
            height: Math.round(primaryFace.boundingBox.height * (await sharp(inputImageBuffer).metadata()).height!)
          })
          .toBuffer();
        
        const baseTemplate = await this.loadThemeTemplate(options.themeId, selectedVariantId);
        try {
          const poseResult = await bedrockService.generatePoseVariation({
            themeId: options.themeId,
            variantId: selectedVariantId,
            action: options.action,
            mood: options.mood || 'epic',
            userFaceBuffer,
            templateBuffer: baseTemplate
          });
          themeTemplate = poseResult.imageBuffer;
          console.log(`[IMAGE_PROCESSING] Dynamic pose generated with action: ${options.action}`);
        } catch (bedrockError) {
          console.log(`[IMAGE_PROCESSING] Bedrock generation failed, falling back to static template:`, bedrockError);
          themeTemplate = baseTemplate;
        }
      } else {
        console.log(`[IMAGE_PROCESSING] Step 5: Loading theme template for ${options.themeId}/${selectedVariantId}`);
        themeTemplate = await this.loadThemeTemplate(options.themeId, selectedVariantId);
      }
      console.log(`[IMAGE_PROCESSING] Theme template ready, size: ${themeTemplate.length} bytes`);
      
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

      // Extract face with context for better blending
      const padding = Math.round(Math.max(faceWidth, faceHeight) * 0.3);
      const expandedX = Math.max(0, faceX - padding);
      const expandedY = Math.max(0, faceY - padding);
      const expandedWidth = Math.min(inputWidth - expandedX, faceWidth + (2 * padding));
      const expandedHeight = Math.min(inputHeight - expandedY, faceHeight + (2 * padding));
      
      // Extract the user's face with surrounding context
      const userFaceWithContext = await sharp(inputImage)
        .extract({ 
          left: expandedX, 
          top: expandedY, 
          width: expandedWidth, 
          height: expandedHeight 
        })
        .toBuffer();

      console.log(`[IMAGE_PROCESSING] Extracted user face: ${expandedWidth}x${expandedHeight}`);

      // Prepare the theme template
      const baseTheme = await sharp(themeTemplate)
        .resize(1024, 1024, { fit: 'cover' })
        .toBuffer();
      
      // Analyze template colors for color matching
      const templateStats = await sharp(baseTheme).stats();
      const templateAvgColor = {
        r: Math.round(templateStats.channels[0].mean),
        g: Math.round(templateStats.channels[1].mean),
        b: Math.round(templateStats.channels[2].mean)
      };
      
      console.log(`[IMAGE_PROCESSING] Template average color: RGB(${templateAvgColor.r}, ${templateAvgColor.g}, ${templateAvgColor.b})`);

      // Determine target position and size
      const targetWidth = 320;
      const targetHeight = 320;
      const targetX = Math.round((1024 - targetWidth) / 2);
      const targetY = Math.round((1024 - targetHeight) / 2.3);
      
      // Process user's face with realistic adaptations
      const adaptedUserFace = await sharp(userFaceWithContext)
        .resize(targetWidth, targetHeight, { fit: 'cover', position: 'center' })
        // Color adaptation to match template lighting
        .modulate({
          brightness: templateAvgColor.r > 150 ? 1.1 : 0.9, // Adapt to template brightness
          saturation: templateAvgColor.g > 120 ? 1.2 : 0.8,  // Enhance or reduce saturation
          hue: templateAvgColor.b > 100 ? 10 : -5            // Slight hue shift for warmth/coolness
        })
        // Enhance contrast for better integration
        .linear(1.1, -(128 * 1.1) + 128)
        .toBuffer();

      // Create a soft circular mask for seamless blending
      const maskSvg = `
        <svg width="${targetWidth}" height="${targetHeight}">
          <defs>
            <radialGradient id="faceMask" cx="50%" cy="50%" r="48%">
              <stop offset="0%" stop-color="white" stop-opacity="1"/>
              <stop offset="85%" stop-color="white" stop-opacity="0.9"/>
              <stop offset="95%" stop-color="white" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="white" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <ellipse cx="50%" cy="50%" rx="48%" ry="48%" fill="url(#faceMask)"/>
        </svg>`;
      
      const faceMask = await sharp(Buffer.from(maskSvg))
        .resize(targetWidth, targetHeight)
        .png()
        .toBuffer();

      // Apply mask to user face for soft edges
      const maskedUserFace = await sharp(adaptedUserFace)
        .composite([{
          input: faceMask,
          blend: 'dest-in'
        }])
        .png()
        .toBuffer();
      
      console.log(`[IMAGE_PROCESSING] Realistic face swap at ${targetX},${targetY} with color adaptation`);

      // Create realistic composite with multiple blending layers
      const result = await sharp(baseTheme)
        .composite([
          // Base face layer
          {
            input: maskedUserFace,
            left: targetX,
            top: targetY,
            blend: 'over'
          },
          // Color matching layer
          {
            input: await sharp(maskedUserFace)
              .modulate({ brightness: 0.8, saturation: 0.7 })
              .toBuffer(),
            left: targetX,
            top: targetY,
            blend: 'multiply'
          },
          // Highlight layer for realism
          {
            input: await sharp(maskedUserFace)
              .modulate({ brightness: 1.3, saturation: 1.1 })
              .toBuffer(),
            left: targetX,
            top: targetY,
            blend: 'screen'
          }
        ])
        .sharpen({ sigma: 1, m1: 0.7, m2: 3 })
        .jpeg({ quality: options.quality || 92, progressive: true })
        .toBuffer();

      return result;
    } catch (error) {
      logger.error('Realistic face swapping failed', { error });
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