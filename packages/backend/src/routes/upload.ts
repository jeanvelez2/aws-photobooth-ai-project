import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uploadRateLimiter } from '../middleware/rateLimiting.js';
import { validate, commonValidations } from '../middleware/validation.js';
import { s3Service, S3UploadError } from '../services/s3.js';
import { logger } from '../utils/logger.js';

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
      requestId,
      fileName,
      fileType,
      fileSize,
    });

    try {
      const result = await s3Service.generatePresignedUploadUrl({
        fileName,
        fileType,
        fileSize,
      });

      logger.info('Pre-signed URL generated successfully', {
        requestId,
        key: result.key,
        expiresIn: result.expiresIn,
      });

      res.json({
        success: true,
        data: {
          uploadUrl: result.uploadUrl,
          key: result.key,
          expiresIn: result.expiresIn,
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const s3Error = error as S3UploadError;
        
        logger.error('S3 service error', {
          requestId,
          error: s3Error.message,
          code: s3Error.code,
        });

        res.status(s3Error.statusCode || 500).json({
          error: s3Error.message,
          code: s3Error.code,
        });
        return;
      }

      logger.error('Unexpected error generating pre-signed URL', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  })
);

export default router;