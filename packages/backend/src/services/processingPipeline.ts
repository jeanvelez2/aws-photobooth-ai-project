import { logger } from '../utils/logger.js';
import { faceDetectionService } from './faceDetection.js';
import { imageProcessingPipeline } from './imageProcessing.js';
import { s3Service } from './s3.js';
import { imageOptimizationService } from './imageOptimization.js';
import { ProcessingJob, ThemeVariant } from 'shared';
import { createSubsegment, addAnnotation, addMetadata } from '../middleware/xray.js';

export interface ProcessingPipelineResult {
  success: boolean;
  resultImageUrl?: string;
  error?: string;
  errorType?: string;
  processingTimeMs: number;
  imageSizeBytes?: number;
}

/**
 * Complete image processing pipeline that integrates face detection and image processing
 */
export class ProcessingPipeline {
  /**
   * Process a complete image processing job from start to finish
   * @param job - The processing job with all required information
   * @param themeVariant - The theme variant to apply
   * @returns Promise<ProcessingPipelineResult> - Processing result with success status and result URL
   */
  async processImage(
    job: ProcessingJob,
    themeVariant: ThemeVariant
  ): Promise<ProcessingPipelineResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting complete image processing pipeline', {
        jobId: job.jobId,
        themeId: job.themeId,
        variantId: job.variantId,
      });

      // Step 1: Download the original image from S3
      logger.info('Downloading original image', { jobId: job.jobId, imageUrl: job.originalImageUrl });
      const originalImageBuffer = await createSubsegment('DownloadImage', async (subsegment) => {
        if (subsegment) {
          subsegment.addAnnotation('imageUrl', job.originalImageUrl);
        }
        return await this.downloadImage(job.originalImageUrl);
      });

      addMetadata('image', {
        originalSizeBytes: originalImageBuffer.length,
        url: job.originalImageUrl,
      });

      // Step 2: Detect face in the image
      logger.info('Starting face detection', { jobId: job.jobId });
      const faceDetectionResult = await createSubsegment('FaceDetection', async (subsegment) => {
        const result = await faceDetectionService.detectFace(originalImageBuffer);
        if (subsegment) {
          subsegment.addAnnotation('confidence', result.confidence);
          subsegment.addAnnotation('landmarkCount', result.landmarks.length);
          subsegment.addMetadata('faceDetection', {
            confidence: result.confidence,
            landmarkCount: result.landmarks.length,
            boundingBox: result.boundingBox,
          });
        }
        return result;
      });

      logger.info('Face detection completed', {
        jobId: job.jobId,
        confidence: faceDetectionResult.confidence,
        landmarkCount: faceDetectionResult.landmarks.length,
      });

      // Step 3: Process the image with the theme
      logger.info('Starting image processing', { jobId: job.jobId, themeVariant: themeVariant.id });
      const processedImageBuffer = await createSubsegment('ImageProcessing', async (subsegment) => {
        if (subsegment) {
          subsegment.addAnnotation('themeVariant', themeVariant.id);
          subsegment.addAnnotation('outputFormat', job.outputFormat);
        }
        return await imageProcessingPipeline.processImage(
          originalImageBuffer,
          faceDetectionResult,
          themeVariant,
          {
            outputFormat: job.outputFormat,
            quality: 90,
            maxWidth: 2400,
            maxHeight: 3200,
          }
        );
      });

      // Step 4: Optimize the processed image
      logger.info('Optimizing processed image', { jobId: job.jobId });
      const optimizedImageResult = await createSubsegment('ImageOptimization', async (subsegment) => {
        const result = await imageOptimizationService.optimizeImage(processedImageBuffer, {
          format: job.outputFormat,
          quality: job.outputFormat === 'jpeg' ? 90 : 95,
          maxWidth: 2400,
          maxHeight: 3200,
          progressive: true,
          stripMetadata: true,
        });
        
        if (subsegment) {
          subsegment.addAnnotation('compressionRatio', result.compressionRatio);
          subsegment.addAnnotation('finalSize', result.size);
          subsegment.addMetadata('optimization', {
            originalSize: processedImageBuffer.length,
            optimizedSize: result.size,
            compressionRatio: result.compressionRatio,
            format: result.format,
          });
        }
        
        return result;
      });

      logger.info('Image optimization completed', {
        jobId: job.jobId,
        originalSize: processedImageBuffer.length,
        optimizedSize: optimizedImageResult.size,
        compressionRatio: optimizedImageResult.compressionRatio,
      });

      // Step 5: Upload the result to S3
      logger.info('Uploading processed image', { jobId: job.jobId });
      const resultImageUrl = await createSubsegment('UploadProcessedImage', async (subsegment) => {
        if (subsegment) {
          subsegment.addAnnotation('imageSizeBytes', optimizedImageResult.size);
          subsegment.addAnnotation('outputFormat', optimizedImageResult.format);
        }
        return await this.uploadProcessedImage(
          optimizedImageResult.buffer,
          job.jobId,
          job.outputFormat
        );
      });

      const processingTimeMs = Date.now() - startTime;
      
      logger.info('Image processing pipeline completed successfully', {
        jobId: job.jobId,
        resultImageUrl,
        processingTimeMs,
      });

      return {
        success: true,
        resultImageUrl,
        processingTimeMs,
        imageSizeBytes: optimizedImageResult.size,
      };

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Image processing pipeline failed', {
        jobId: job.jobId,
        error: errorMessage,
        processingTimeMs,
      });

      // Determine error type for metrics
      const errorType = this.getErrorType(errorMessage);
      
      return {
        success: false,
        error: this.mapErrorToUserFriendlyMessage(errorMessage),
        errorType,
        processingTimeMs,
      };
    }
  }

  /**
   * Download image from S3 URL
   * @param imageUrl - S3 URL of the image
   * @returns Promise<Buffer> - Image buffer
   */
  private async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      // Extract bucket and key from S3 URL
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      if (pathParts.length < 1) {
        throw new Error('Invalid S3 URL format');
      }

      // For URLs like https://bucket.s3.amazonaws.com/key, bucket is in hostname
      // For URLs like https://s3.amazonaws.com/bucket/key, bucket is first path part
      let bucket: string;
      let key: string;
      
      if (url.hostname.includes('.s3.')) {
        // Format: https://bucket.s3.amazonaws.com/key
        bucket = url.hostname.split('.')[0] || '';
        key = pathParts.join('/');
      } else {
        // Format: https://s3.amazonaws.com/bucket/key
        bucket = pathParts[0] || '';
        key = pathParts.slice(1).join('/');
      }

      if (!bucket || !key) {
        throw new Error('Could not extract bucket and key from S3 URL');
      }

      // Download from S3
      const imageBuffer = await s3Service.downloadFile(bucket, key);
      
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Downloaded image is empty');
      }

      return imageBuffer;
    } catch (error) {
      logger.error('Failed to download image', { imageUrl, error });
      throw new Error('DOWNLOAD_FAILED');
    }
  }

  /**
   * Upload processed image to S3
   * @param imageBuffer - Processed image buffer
   * @param jobId - Job ID for naming
   * @param outputFormat - Output format (jpeg/png)
   * @returns Promise<string> - S3 URL of uploaded image
   */
  private async uploadProcessedImage(
    imageBuffer: Buffer,
    jobId: string,
    outputFormat: 'jpeg' | 'png'
  ): Promise<string> {
    try {
      const fileName = `processed/${jobId}.${outputFormat}`;
      const contentType = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';

      const uploadResult = await s3Service.uploadFile(
        fileName,
        imageBuffer,
        contentType
      );

      return uploadResult.url;
    } catch (error) {
      logger.error('Failed to upload processed image', { jobId, error });
      throw new Error('UPLOAD_FAILED');
    }
  }

  /**
   * Get error type for monitoring metrics
   * @param errorMessage - Internal error message
   * @returns string - Error type for metrics
   */
  private getErrorType(errorMessage: string): string {
    if (errorMessage.includes('NO_FACE_DETECTED')) return 'NO_FACE_DETECTED';
    if (errorMessage.includes('MULTIPLE_FACES')) return 'MULTIPLE_FACES';
    if (errorMessage.includes('POOR_IMAGE_QUALITY')) return 'POOR_IMAGE_QUALITY';
    if (errorMessage.includes('FACE_TOO_SMALL')) return 'FACE_TOO_SMALL';
    if (errorMessage.includes('EXTREME_POSE')) return 'EXTREME_POSE';
    if (errorMessage.includes('DOWNLOAD_FAILED')) return 'DOWNLOAD_FAILED';
    if (errorMessage.includes('UPLOAD_FAILED')) return 'UPLOAD_FAILED';
    if (errorMessage.includes('PROCESSING_TIMEOUT')) return 'PROCESSING_TIMEOUT';
    return 'INTERNAL_ERROR';
  }

  /**
   * Map internal error messages to user-friendly messages
   * @param errorMessage - Internal error message
   * @returns string - User-friendly error message
   */
  private mapErrorToUserFriendlyMessage(errorMessage: string): string {
    const errorMap: Record<string, string> = {
      'NO_FACE_DETECTED': 'No face was detected in the image. Please ensure your face is clearly visible and well-lit.',
      'MULTIPLE_FACES': 'Multiple faces were detected. Please ensure only one person is in the image.',
      'POOR_IMAGE_QUALITY': 'The image quality is too poor for processing. Please use a clearer, well-lit photo.',
      'FACE_TOO_SMALL': 'The face in the image is too small. Please take a closer photo.',
      'EXTREME_POSE': 'The face angle is too extreme. Please face the camera more directly.',
      'DOWNLOAD_FAILED': 'Failed to download the original image. Please try uploading again.',
      'UPLOAD_FAILED': 'Failed to save the processed image. Please try again.',
      'IMAGE_PROCESSING_FAILED': 'Image processing failed due to a technical error. Please try again.',
      'FACE_ALIGNMENT_FAILED': 'Failed to align the face properly. Please try with a different photo.',
      'COLOR_CORRECTION_FAILED': 'Failed to adjust image colors. Please try again.',
      'FACE_BLENDING_FAILED': 'Failed to blend the face with the theme. Please try again.',
      'IMAGE_FINALIZATION_FAILED': 'Failed to finalize the processed image. Please try again.',
      'INSUFFICIENT_LANDMARKS': 'Could not detect enough facial features. Please use a clearer photo.',
      'INTERNAL_ERROR': 'An internal error occurred. Please try again later.',
    };

    return errorMap[errorMessage] || 'An unexpected error occurred during processing. Please try again.';
  }

  /**
   * Validate processing request before starting
   * @param job - Processing job to validate
   * @param themeVariant - Theme variant to validate
   * @throws Error if validation fails
   */
  validateProcessingRequest(job: ProcessingJob, themeVariant: ThemeVariant): void {
    if (!job.originalImageUrl) {
      throw new Error('Original image URL is required');
    }

    if (!job.themeId || !job.outputFormat) {
      throw new Error('Theme ID and output format are required');
    }

    if (!themeVariant.templateUrl || !themeVariant.faceRegion) {
      throw new Error('Theme variant is missing required template or face region data');
    }

    // Validate face region bounds
    const { faceRegion } = themeVariant;
    if (
      faceRegion.x < 0 || faceRegion.x > 1 ||
      faceRegion.y < 0 || faceRegion.y > 1 ||
      faceRegion.width <= 0 || faceRegion.width > 1 ||
      faceRegion.height <= 0 || faceRegion.height > 1
    ) {
      throw new Error('Theme variant has invalid face region coordinates');
    }
  }
}

export const processingPipeline = new ProcessingPipeline();