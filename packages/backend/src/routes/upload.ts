import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uploadRateLimiter } from '../middleware/rateLimiting.js';
import { validate, commonValidations } from '../middleware/validation.js';
import { uploadService } from '../services/uploadService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const router = Router();

// Enhanced validation middleware for presigned URL request
const validatePresignedRequest = validate([
  commonValidations.string('fileName', 1, 255),
  commonValidations.imageType('fileType'),
  commonValidations.fileSize('fileSize', 10 * 1024 * 1024), // 10MB max
  // Additional security validations
  body('fileName')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('fileName can only contain alphanumeric characters, dots, hyphens, and underscores'),
  body('fileName')
    .not()
    .matches(/\.(exe|bat|cmd|scr|pif|com)$/i)
    .withMessage('fileName cannot have executable file extensions'),
]);

/**
 * POST /api/upload/presigned
 * Generate a pre-signed URL for uploading images to S3
 */
router.post(
  '/presigned',
  uploadRateLimiter, // Apply upload-specific rate limiting
  validatePresignedRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string;

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed for presigned URL request', {
        requestId,
        errors: errors.array(),
      });
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { fileName, fileType, fileSize } = req.body;

    logger.info('Generating pre-signed upload URL', {
      requestId: requestId?.replace(/[\r\n\t]/g, '') || 'unknown',
      fileName: fileName?.replace(/[\r\n\t]/g, '') || 'unknown',
      fileType: fileType?.replace(/[\r\n\t]/g, '') || 'unknown',
      fileSize,
    });

    try {
      // Validate file
      const validation = uploadService.validateImageFile({ size: fileSize, type: fileType });
      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error,
          code: 'INVALID_FILE',
        });
      }

      const result = await uploadService.generatePresignedUploadUrl(fileType);

      logger.info('Pre-signed URL generated successfully', {
        requestId: requestId?.replace(/[\r\n\t]/g, '') || 'unknown',
        key: result.key?.replace(/[\r\n\t]/g, '') || 'unknown',
        photoId: result.photoId,
      });

      // Construct the S3 URL for the uploaded file
      const s3Url = `https://${process.env.S3_BUCKET_NAME || config.aws.s3.bucketName}.s3.amazonaws.com/${result.key}`;
      
      res.json({
        success: true,
        data: {
          uploadUrl: result.uploadUrl,
          key: result.key,
          photoId: result.photoId,
          s3Url: s3Url,
          expiresIn: 300,
        },
      });
    } catch (error) {
      logger.error('Error generating pre-signed URL', {
        requestId: requestId?.replace(/[\r\n\t]/g, '') || 'unknown',
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
      });

      res.status(500).json({
        error: 'Failed to generate upload URL',
        code: 'UPLOAD_ERROR',
      });
    }
  })
);

export default router;