/**
 * Example usage of the ImageProcessingPipeline
 * This demonstrates how to use the image processing pipeline in a real scenario
 */

import { ImageProcessingPipeline } from '../services/imageProcessing.js';
import { FaceDetectionService } from '../services/faceDetection.js';
import { ThemeVariant } from 'shared';
import { logger } from '../utils/logger.js';

/**
 * Example function showing complete image processing workflow
 */
export async function processUserPhoto(
  imageBuffer: Buffer,
  themeVariant: ThemeVariant
): Promise<Buffer> {
  const faceDetectionService = new FaceDetectionService();
  const imageProcessingPipeline = new ImageProcessingPipeline();

  try {
    logger.info('Starting complete image processing workflow', {
      imageSize: imageBuffer.length,
      themeId: themeVariant.id,
    });

    // Step 1: Detect face in the uploaded image
    logger.info('Step 1: Detecting face in image');
    const faceDetection = await faceDetectionService.detectFace(imageBuffer);
    
    logger.info('Face detection completed', {
      confidence: faceDetection.confidence,
      landmarkCount: faceDetection.landmarks.length,
      faceSize: `${faceDetection.boundingBox.width}x${faceDetection.boundingBox.height}`,
    });

    // Step 2: Process the image with the selected theme
    logger.info('Step 2: Processing image with theme');
    const processedImage = await imageProcessingPipeline.processImage(
      imageBuffer,
      faceDetection,
      themeVariant,
      {
        outputFormat: 'jpeg',
        quality: 90,
        maxWidth: 2400,
        maxHeight: 3200,
      }
    );

    logger.info('Image processing completed successfully', {
      originalSize: imageBuffer.length,
      processedSize: processedImage.length,
      compressionRatio: (processedImage.length / imageBuffer.length).toFixed(2),
    });

    return processedImage;
  } catch (error) {
    logger.error('Image processing workflow failed', {
      error: error instanceof Error ? error.message : error,
      themeId: themeVariant.id,
    });
    throw error;
  }
}

/**
 * Example function for batch processing multiple images
 */
export async function batchProcessImages(
  images: { buffer: Buffer; filename: string }[],
  themeVariant: ThemeVariant
): Promise<{ filename: string; processedImage: Buffer; success: boolean; error?: string }[]> {
  const results = [];

  for (const { buffer, filename } of images) {
    try {
      logger.info('Processing image in batch', { filename, themeId: themeVariant.id });
      
      const processedImage = await processUserPhoto(buffer, themeVariant);
      
      results.push({
        filename,
        processedImage,
        success: true,
      });
    } catch (error) {
      logger.error('Batch processing failed for image', {
        filename,
        error: error instanceof Error ? error.message : error,
      });
      
      // Sanitize error message to prevent XSS
      const escapeMap: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      const sanitizedError = error instanceof Error ? 
        error.message.replace(/[<>"'&]/g, (match) => escapeMap[match] || match) : 'Unknown error';
      
      results.push({
        filename,
        processedImage: Buffer.alloc(0),
        success: false,
        error: sanitizedError,
      });
    }
  }

  return results;
}

/**
 * Example function showing different processing options
 */
export async function processWithDifferentOptions(
  imageBuffer: Buffer,
  faceDetection: any,
  themeVariant: ThemeVariant
) {
  const pipeline = new ImageProcessingPipeline();

  // High quality PNG output
  const highQualityPng = await pipeline.processImage(
    imageBuffer,
    faceDetection,
    themeVariant,
    {
      outputFormat: 'png',
      quality: 100,
      maxWidth: 4000,
      maxHeight: 6000,
    }
  );

  // Compressed JPEG for web
  const webOptimized = await pipeline.processImage(
    imageBuffer,
    faceDetection,
    themeVariant,
    {
      outputFormat: 'jpeg',
      quality: 75,
      maxWidth: 1200,
      maxHeight: 1600,
    }
  );

  // Thumbnail version
  const thumbnail = await pipeline.processImage(
    imageBuffer,
    faceDetection,
    themeVariant,
    {
      outputFormat: 'jpeg',
      quality: 80,
      maxWidth: 400,
      maxHeight: 600,
    }
  );

  return {
    highQuality: highQualityPng,
    webOptimized,
    thumbnail,
  };
}

/**
 * Example error handling patterns
 */
export async function processWithErrorHandling(
  imageBuffer: Buffer,
  themeVariant: ThemeVariant
): Promise<{ success: boolean; result?: Buffer; error?: string; errorType?: string }> {
  try {
    const processedImage = await processUserPhoto(imageBuffer, themeVariant);
    return {
      success: true,
      result: processedImage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Map specific errors to user-friendly messages
    let userFriendlyError = 'An unexpected error occurred';
    let errorType = 'UNKNOWN_ERROR';
    
    switch (errorMessage) {
      case 'NO_FACE_DETECTED':
        userFriendlyError = 'No face was detected in the image. Please ensure your face is clearly visible and try again.';
        errorType = 'NO_FACE_DETECTED';
        break;
      case 'MULTIPLE_FACES':
        userFriendlyError = 'Multiple faces detected. Please ensure only one person is in the photo.';
        errorType = 'MULTIPLE_FACES';
        break;
      case 'POOR_IMAGE_QUALITY':
        userFriendlyError = 'Image quality is too low. Please use a clearer, well-lit photo.';
        errorType = 'POOR_IMAGE_QUALITY';
        break;
      case 'FACE_TOO_SMALL':
        userFriendlyError = 'Face is too small in the image. Please take a closer photo.';
        errorType = 'FACE_TOO_SMALL';
        break;
      case 'EXTREME_POSE':
        userFriendlyError = 'Face angle is too extreme. Please face the camera more directly.';
        errorType = 'EXTREME_POSE';
        break;
      case 'IMAGE_PROCESSING_FAILED':
      case 'FACE_ALIGNMENT_FAILED':
      case 'COLOR_CORRECTION_FAILED':
      case 'FACE_BLENDING_FAILED':
      case 'IMAGE_FINALIZATION_FAILED':
        userFriendlyError = 'Image processing failed. Please try again with a different photo.';
        errorType = 'PROCESSING_ERROR';
        break;
    }
    
    // Sanitize error messages to prevent XSS
    const escapeMap: { [key: string]: string } = {
      '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'
    };
    const sanitizedError = userFriendlyError.replace(/[<>"'&]/g, (match) => escapeMap[match] || match);
    const sanitizedErrorType = errorType.replace(/[<>"'&]/g, (match) => escapeMap[match] || match);
    
    return {
      success: false,
      error: sanitizedError,
      errorType: sanitizedErrorType,
    };
  }
}

/**
 * Example theme variant for testing
 */
export const exampleThemeVariant: ThemeVariant = {
  id: 'barbarian-warrior-v1',
  name: 'Barbarian Warrior',
  description: 'Transform into a fierce barbarian warrior',
  thumbnailUrl: 'https://example.com/themes/barbarian/thumbnail.jpg',
  templateUrl: 'https://example.com/themes/barbarian/template.jpg',
  faceRegion: {
    x: 150,
    y: 200,
    width: 300,
    height: 400,
    rotation: 0,
  },
  colorAdjustments: {
    brightness: 15,
    contrast: 1.2,
    saturation: 10,
    hue: -5,
  },
};

/**
 * Example usage in an Express route handler
 */
export function createProcessingRouteHandler() {
  return async (req: any, res: any) => {
    try {
      const { imageBuffer, themeId } = req.body;
      
      // Sanitize themeId to prevent XSS
      const escapeMap: { [key: string]: string } = {
        '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'
      };
      const sanitizedThemeId = typeof themeId === 'string' ? 
        themeId.replace(/[<>"'&]/g, (match) => escapeMap[match] || match) : 'unknown';
      
      // In a real implementation, you would fetch the theme variant from database
      const themeVariant = exampleThemeVariant; // This would come from your theme service
      
      const result = await processWithErrorHandling(imageBuffer, themeVariant);
      
      if (result.success) {
        res.set('Content-Type', 'image/jpeg');
        res.send(result.result);
      } else {
        // Error messages are already sanitized in processWithErrorHandling
        res.status(400).json({
          error: result.error,
          errorType: result.errorType,
        });
      }
    } catch (error) {
      // Sanitize error for logging to prevent XSS in logs
      const sanitizedLogError = error instanceof Error ? 
        error.message.replace(/[<>"'&]/g, (match) => {
          const escapeMap: { [key: string]: string } = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;'
          };
          return escapeMap[match] || match;
        }) : 'Unknown error';
      
      logger.error('Route handler error', { error: sanitizedLogError });
      res.status(500).json({
        error: 'Internal server error',
        errorType: 'INTERNAL_ERROR',
      });
    }
  };
}