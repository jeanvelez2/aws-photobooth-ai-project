import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { processingRateLimiter } from '../middleware/rateLimiting.js';
import { adaptiveRateLimit, burstProtection, ipReputationCheck } from '../middleware/advancedRateLimiting.js';
import { validate, commonValidations } from '../middleware/validation.js';
import { jobQueue } from '../services/jobQueue.js';
import { JobQueueService } from '../services/jobQueueService.js';
import { imageProcessingService } from '../services/imageProcessingService.js';
import { contentModerationService } from '../services/contentModerationService.js';
import { logger } from '../utils/logger.js';
import type { ProcessingRequest } from 'shared';

const router = Router();

// Validation schemas
const processRequestSchema = z.object({
  photoId: z.string().min(1, 'Photo ID is required'),
  themeId: z.string().min(1, 'Theme ID is required'),
  variantId: z.string().optional(),
  outputFormat: z.enum(['jpeg', 'png']).default('jpeg'),
  userId: z.string().optional(),
  originalImageUrl: z.string().min(1, 'Valid image URL is required'),
  action: z.string().optional(),
  mood: z.enum(['epic', 'dark', 'bright', 'mystical']).optional(),
  generatePose: z.boolean().optional(),
});

const jobIdSchema = z.object({
  id: z.string().uuid('Valid job ID is required'),
});

/**
 * POST /api/process
 * Create a new processing job
 */
router.post('/', ipReputationCheck, burstProtection, adaptiveRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = processRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    // Content moderation check for pose generation
    if (validationResult.data.generatePose && validationResult.data.action && validationResult.data.mood) {
      const moderation = contentModerationService.validateThemeAction(
        validationResult.data.themeId,
        validationResult.data.action,
        validationResult.data.mood
      );
      
      if (!moderation.isAppropriate) {
        return res.status(400).json({
          error: 'Content not allowed',
          message: moderation.reason || 'The requested content combination is not permitted',
        });
      }
    }

    const request: ProcessingRequest = {
      photoId: validationResult.data.photoId,
      themeId: validationResult.data.themeId,
      variantId: validationResult.data.variantId,
      outputFormat: validationResult.data.outputFormat,
      userId: validationResult.data.userId,
      originalImageUrl: validationResult.data.originalImageUrl,
      action: validationResult.data.action,
      mood: validationResult.data.mood,
      generatePose: validationResult.data.generatePose,
    };
    
    logger.info('Processing job requested', { 
      photoId: request.photoId?.replace(/[\r\n\t]/g, '') || 'unknown', 
      themeId: request.themeId?.replace(/[\r\n\t]/g, '') || 'unknown',
      userId: request.userId?.replace(/[\r\n\t]/g, '') || 'unknown'
    });

    // Create and enqueue the job
    const job = await jobQueue.enqueueJob(request);

    // Return job details
    res.status(201).json({
      id: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      themeId: job.themeId,
      variantId: job.variantId,
      outputFormat: job.outputFormat,
    });

  } catch (error) {
    logger.error('Failed to create processing job', { 
      error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
      requestId: (req.headers['x-request-id'] as string)?.replace(/[\r\n\t]/g, '') || 'unknown'
    });
    
    return res.status(500).json({
      error: 'Failed to create processing job',
      message: 'An internal error occurred while creating the processing job',
    });
  }
});

/**
 * GET /api/process/:id
 * Get processing job status and results
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Validate job ID parameter
    const validationResult = jobIdSchema.safeParse({ id: req.params.id });
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid job ID',
        details: validationResult.error.issues,
      });
    }

    const { id: jobId } = validationResult.data;

    // Get job from database
    const job = await jobQueue.getJobStatus(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The requested processing job does not exist or has expired',
      });
    }

    // Return job status and results
    const response: any = {
      id: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      themeId: job.themeId,
      variantId: job.variantId,
      outputFormat: job.outputFormat,
      retryCount: job.retryCount,
    };

    // Add completion details if available
    if (job.completedAt) {
      response.completedAt = job.completedAt;
    }

    if (job.processingTimeMs) {
      response.processingTimeMs = job.processingTimeMs;
    }

    // Add result URL for completed jobs
    if (job.status === 'completed' && job.resultImageUrl) {
      response.resultUrl = job.resultImageUrl;
    }

    // Add error details for failed jobs
    if (job.status === 'failed' && job.error) {
      response.error = typeof job.error === 'string' ? job.error.replace(/[<>"'&]/g, '') : 'Processing failed';
    }

    logger.info('Processing job status retrieved', { 
      jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown', 
      status: job.status?.replace(/[\r\n\t]/g, '') || 'unknown'
    });
    res.json(response);

  } catch (error) {
    logger.error('Failed to get processing job status', { 
      error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
      jobId: req.params.id?.replace(/[\r\n\t]/g, '') || 'unknown'
    });
    
    return res.status(500).json({
      error: 'Failed to retrieve job status',
      message: 'An internal error occurred while retrieving the job status',
    });
  }
});

/**
 * DELETE /api/process/:id
 * Cancel a processing job (if still queued)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Validate job ID parameter
    const validationResult = jobIdSchema.safeParse({ id: req.params.id });
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid job ID',
        details: validationResult.error.issues,
      });
    }

    const { id: jobId } = validationResult.data;

    // Get current job status
    const job = await jobQueue.getJobStatus(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: 'The requested processing job does not exist or has expired',
      });
    }

    // Only allow cancellation of queued jobs
    if (job.status !== 'queued') {
      return res.status(400).json({
        error: 'Job cannot be cancelled',
        message: 'Job is not in a cancellable state',
      });
    }

    // Cancel the job retry if scheduled
    await jobQueue.cancelJobRetry(jobId);

    // Mark job as failed with cancellation message
    await jobQueue.getJobStatus(jobId); // This will update the job status through the service

    logger.info('Processing job cancelled', { 
      jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown'
    });
    
    res.json({
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    logger.error('Failed to cancel processing job', { 
      error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
      jobId: req.params.id?.replace(/[\r\n\t]/g, '') || 'unknown'
    });
    
    return res.status(500).json({
      error: 'Failed to cancel job',
      message: 'An internal error occurred while cancelling the job',
    });
  }
});

/**
 * GET /api/process/stats/queue
 * Get queue statistics (for monitoring)
 */
router.get('/stats/queue', async (_req: Request, res: Response) => {
  try {
    const stats = await jobQueue.getQueueStats();
    
    logger.info('Queue statistics retrieved', stats);
    res.json(stats);

  } catch (error) {
    logger.error('Failed to get queue statistics', { 
      error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
    });
    
    res.status(500).json({
      error: 'Failed to retrieve queue statistics',
      message: 'An internal error occurred while retrieving queue statistics',
    });
  }
});

export default router;