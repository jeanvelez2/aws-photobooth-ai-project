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
    console.log(`[IMAGE_PROCESSING] Starting image processing for ${inputImageKey} with options:`, {
      themeId: options.themeId,
      variantId: options.variantId,
      outputFormat: options.outputFormat,
      generatePose: options.generatePose,
      action: options.action,
      mood: options.mood
    });
    
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
      console.log(`[IMAGE_PROCESSING] Pose generation check:`, {
        generatePose: options.generatePose,
        action: options.action,
        mood: options.mood,
        willGeneratePose: !!(options.generatePose && options.action)
      });
      
      if (options.generatePose && options.action) {
        console.log(`[IMAGE_PROCESSING] Step 5a: Generating dynamic pose with Bedrock`);
        console.log(`[IMAGE_PROCESSING] Bedrock parameters:`, {
          themeId: options.themeId,
          variantId: selectedVariantId,
          action: options.action,
          mood: options.mood || 'epic'
        });
        
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
          console.log(`[IMAGE_PROCESSING] Calling Bedrock service...`);
          const poseResult = await bedrockService.generatePoseVariation({
            themeId: options.themeId,
            variantId: selectedVariantId,
            action: options.action,
            mood: options.mood || 'epic',
            userFaceBuffer,
            templateBuffer: baseTemplate
          });
          themeTemplate = poseResult.imageBuffer;
          console.log(`[IMAGE_PROCESSING] ✅ Dynamic pose generated successfully with action: ${options.action}`);
        } catch (bedrockError) {
          console.log(`[IMAGE_PROCESSING] ❌ Bedrock generation failed:`, {
            error: bedrockError.message,
            code: bedrockError.code,
            name: bedrockError.name
          });
          console.log(`[IMAGE_PROCESSING] Using static template with enhanced face blending`);
          themeTemplate = baseTemplate;
        }
      } else {
        console.log(`[IMAGE_PROCESSING] Step 5: Using static template (no pose generation requested)`);
        themeTemplate = await this.loadThemeTemplate(options.themeId, selectedVariantId);
      }
      console.log(`[IMAGE_PROCESSING] Theme template ready, size: ${themeTemplate.length} bytes`);
      
      // Step 6: Process the image (face swap with theme)
      console.log(`[IMAGE_PROCESSING] Step 6: Face swapping with theme`);
      let processedImageBuffer;
      
      if (options.generatePose && options.action) {
        // Use the Bedrock-generated image (already has face swap)
        processedImageBuffer = themeTemplate;
        console.log(`[IMAGE_PROCESSING] Using Bedrock face-swapped image`);
      } else {
        // Fallback to basic blending for static templates
        processedImageBuffer = await this.blendImages(
          inputImageBuffer,
          themeTemplate,
          faceDetection,
          options
        );
        console.log(`[IMAGE_PROCESSING] Basic face blending completed`);
      }
      
      console.log(`[IMAGE_PROCESSING] Image processing completed, result size: ${processedImageBuffer.length} bytes`);

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
      const userFace = faceDetection.faces[0];
      
      // Get input image metadata
      const inputMetadata = await sharp(inputImage).metadata();
      const inputWidth = inputMetadata.width || 1024;
      const inputHeight = inputMetadata.height || 1024;
      
      // Extract user's face with padding
      const faceX = Math.max(0, Math.round(userFace.boundingBox.left * inputWidth));
      const faceY = Math.max(0, Math.round(userFace.boundingBox.top * inputHeight));
      const faceWidth = Math.min(inputWidth - faceX, Math.round(userFace.boundingBox.width * inputWidth));
      const faceHeight = Math.min(inputHeight - faceY, Math.round(userFace.boundingBox.height * inputHeight));
      
      const padding = Math.round(Math.max(faceWidth, faceHeight) * 0.4);
      const expandedX = Math.max(0, faceX - padding);
      const expandedY = Math.max(0, faceY - padding);
      const expandedWidth = Math.min(inputWidth - expandedX, faceWidth + (2 * padding));
      const expandedHeight = Math.min(inputHeight - expandedY, faceHeight + (2 * padding));
      
      const userFaceBuffer = await sharp(inputImage)
        .extract({ left: expandedX, top: expandedY, width: expandedWidth, height: expandedHeight })
        .toBuffer();

      // Prepare template
      const templateBuffer = await sharp(themeTemplate)
        .resize(1024, 1024, { fit: 'cover' })
        .toBuffer();

      // Try to detect face in template for precise replacement
      let templateFaceRegion = null;
      try {
        // Save template temporarily for face detection
        const tempKey = `temp/template-${Date.now()}.jpg`;
        await this.saveImageToS3(tempKey, templateBuffer, 'jpeg');
        const templateFaceDetection = await faceDetectionService.detectFaces(tempKey);
        
        if (templateFaceDetection.faces.length > 0) {
          const templateFace = templateFaceDetection.faces[0];
          templateFaceRegion = {
            x: Math.round(templateFace.boundingBox.left * 1024),
            y: Math.round(templateFace.boundingBox.top * 1024),
            width: Math.round(templateFace.boundingBox.width * 1024),
            height: Math.round(templateFace.boundingBox.height * 1024)
          };
          console.log(`[IMAGE_PROCESSING] Template face detected at:`, templateFaceRegion);
        }
      } catch (error) {
        console.log(`[IMAGE_PROCESSING] Template face detection failed, using default position`);
      }

      // Determine target region (template face or default)
      const targetRegion = templateFaceRegion || {
        x: Math.round((1024 - 280) / 2),
        y: Math.round((1024 - 280) / 2.2),
        width: 280,
        height: 280
      };

      // Analyze template colors around face region for better matching
      const templateFaceArea = await sharp(templateBuffer)
        .extract({
          left: Math.max(0, targetRegion.x - 20),
          top: Math.max(0, targetRegion.y - 20),
          width: Math.min(1024 - targetRegion.x, targetRegion.width + 40),
          height: Math.min(1024 - targetRegion.y, targetRegion.height + 40)
        })
        .toBuffer();
      
      const templateStats = await sharp(templateFaceArea).stats();
      const templateColor = {
        r: templateStats.channels[0].mean,
        g: templateStats.channels[1].mean,
        b: templateStats.channels[2].mean
      };

      // Adapt user face to match template lighting and colors
      const adaptedFace = await sharp(userFaceBuffer)
        .resize(targetRegion.width, targetRegion.height, { fit: 'cover', position: 'center' })
        .modulate({
          brightness: templateColor.r > 128 ? 1.15 : 0.85,
          saturation: templateColor.g > 128 ? 1.2 : 0.9,
          hue: templateColor.b > templateColor.r ? 5 : -5
        })
        .linear(1.1, -(128 * 1.1) + 128) // Enhance contrast
        .toBuffer();

      // Create feathered mask for seamless blending
      const maskSvg = `<svg width="${targetRegion.width}" height="${targetRegion.height}">
        <defs>
          <radialGradient id="mask" cx="50%" cy="50%" r="48%">
            <stop offset="0%" stop-color="white" stop-opacity="1"/>
            <stop offset="70%" stop-color="white" stop-opacity="1"/>
            <stop offset="85%" stop-color="white" stop-opacity="0.8"/>
            <stop offset="95%" stop-color="white" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="white" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="50%" cy="50%" rx="48%" ry="48%" fill="url(#mask)"/>
      </svg>`;
      
      const mask = await sharp(Buffer.from(maskSvg))
        .resize(targetRegion.width, targetRegion.height)
        .png()
        .toBuffer();

      // Apply mask to face
      const maskedFace = await sharp(adaptedFace)
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toBuffer();

      console.log(`[IMAGE_PROCESSING] Face swapping at ${targetRegion.x},${targetRegion.y} size ${targetRegion.width}x${targetRegion.height}`);

      // Multi-layer composite for realistic blending
      const result = await sharp(templateBuffer)
        .composite([
          // Base face replacement
          {
            input: maskedFace,
            left: targetRegion.x,
            top: targetRegion.y,
            blend: 'over'
          },
          // Color matching layer
          {
            input: await sharp(maskedFace)
              .modulate({ brightness: 0.7, saturation: 0.8 })
              .toBuffer(),
            left: targetRegion.x,
            top: targetRegion.y,
            blend: 'multiply'
          }
        ])
        .sharpen({ sigma: 0.8, m1: 0.5, m2: 2 })
        .jpeg({ quality: options.quality || 90 })
        .toBuffer();

      return result;
    } catch (error) {
      logger.error('Face swapping failed', { error });
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