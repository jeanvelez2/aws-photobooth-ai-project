import { logger } from '../utils/logger.js';
import { processingPipeline } from './processingPipeline.js';
import { processingJobService } from './processingJob.js';
import { monitoringService } from './monitoring.js';
import { ThemeService } from './themeService.js';

import { ProcessingJob } from 'shared';
import { createSubsegment, addAnnotation, addMetadata } from '../middleware/xray.js';

/**
 * Worker service that processes jobs from the queue
 */
export class ProcessingWorker {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private themeService = new ThemeService();

  /**
   * Start the processing worker
   * @param intervalMs - Interval between job checks in milliseconds
   */
  start(intervalMs = 5000): void {
    if (this.processingInterval) {
      logger.warn('Processing worker is already running');
      return;
    }

    logger.info('Starting processing worker', { intervalMs });
    
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNextJob();
      }
    }, intervalMs);
  }

  /**
   * Stop the processing worker
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Processing worker stopped');
    }
  }

  /**
   * Process the next available job in the queue
   */
  private async processNextJob(): Promise<void> {
    try {
      this.isProcessing = true;

      // Get the next queued job
      const job = await processingJobService.getNextQueuedJob();
      
      if (!job) {
        // No jobs to process
        return;
      }

      logger.info('Starting job processing', { jobId: job.jobId });

      // Add X-Ray annotations for tracing
      addAnnotation('jobId', job.jobId);
      addAnnotation('themeId', job.themeId);
      if (job.variantId) {
        addAnnotation('variantId', job.variantId);
      }

      // Update job status to processing
      await processingJobService.updateJobStatus(job.jobId, 'processing');

      // Find the theme variant
      const themeVariant = await this.findThemeVariant(job.themeId, job.variantId);
      
      if (!themeVariant) {
        await this.handleJobError(job.jobId, 'THEME_NOT_FOUND', 'The selected theme variant was not found');
        return;
      }

      // Validate the processing request
      try {
        processingPipeline.validateProcessingRequest(job, themeVariant);
      } catch (validationError) {
        const errorMessage = validationError instanceof Error ? validationError.message : 'Validation failed';
        await this.handleJobError(job.jobId, 'VALIDATION_FAILED', errorMessage);
        return;
      }

      // Process the image with X-Ray tracing
      const result = await createSubsegment('ProcessImage', async (subsegment) => {
        if (subsegment) {
          subsegment.addAnnotation('themeId', job.themeId);
          subsegment.addMetadata('job', {
            id: job.jobId,
            themeId: job.themeId,
            variantId: job.variantId,
            createdAt: job.createdAt,
          });
        }
        return await processingPipeline.processImage(job, themeVariant);
      });

      if (result.success && result.resultImageUrl) {
        // Record successful processing metrics
        await monitoringService.recordProcessingMetrics({
          processingTimeMs: result.processingTimeMs || 0,
          success: true,
          themeId: job.themeId,
          imageSize: result.imageSizeBytes,
        });

        // Update job as completed
        await processingJobService.completeJob(
          job.jobId,
          result.resultImageUrl,
          result.processingTimeMs
        );
        
        logger.info('Job completed successfully', {
          jobId: job.jobId,
          resultUrl: result.resultImageUrl,
          processingTimeMs: result.processingTimeMs,
          imageSizeBytes: result.imageSizeBytes,
        });

        // Add X-Ray metadata for successful processing
        addMetadata('processing', {
          success: true,
          processingTimeMs: result.processingTimeMs,
          imageSizeBytes: result.imageSizeBytes,
        });
      } else {
        // Record failed processing metrics
        await monitoringService.recordProcessingMetrics({
          processingTimeMs: result.processingTimeMs || 0,
          success: false,
          errorType: result.errorType || 'PROCESSING_FAILED',
          themeId: job.themeId,
        });

        // Add X-Ray metadata for failed processing
        addMetadata('processing', {
          success: false,
          error: result.error,
          errorType: result.errorType,
        });

        // Handle processing failure
        await this.handleJobError(
          job.jobId,
          result.errorType || 'PROCESSING_FAILED',
          result.error || 'Image processing failed'
        );
      }

    } catch (error) {
      logger.error('Error in job processing worker', {
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle job processing errors
   * @param jobId - Job ID
   * @param errorCode - Error code
   * @param errorMessage - Error message
   */
  private async handleJobError(jobId: string, errorCode: string, errorMessage: string): Promise<void> {
    try {
      const job = await processingJobService.getJobById(jobId);
      
      if (!job) {
        logger.error('Job not found when handling error', { jobId });
        return;
      }

      // Check if we should retry
      const maxRetries = 3;
      if (job.retryCount < maxRetries) {
        logger.info('Retrying job', { jobId, retryCount: job.retryCount + 1, maxRetries });
        await processingJobService.retryJob(jobId);
      } else {
        logger.error('Job failed after maximum retries', { jobId, errorCode, errorMessage });
        await processingJobService.failJob(jobId, `${errorCode}: ${errorMessage}`);
      }
    } catch (error) {
      logger.error('Error handling job error', {
        jobId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Find theme variant by theme ID and variant ID
   * @param themeId - Theme ID
   * @param variantId - Variant ID (optional)
   * @returns ThemeVariant or null if not found
   */
  private async findThemeVariant(themeId: string, variantId?: string) {
    const theme = await this.themeService.getThemeById(themeId);
    
    if (!theme) {
      return null;
    }

    if (!variantId) {
      // Return first variant if no specific variant requested
      return theme.variants[0] || null;
    }

    return theme.variants.find(v => v.id === variantId) || null;
  }

  /**
   * Get processing worker status
   */
  getStatus() {
    return {
      isRunning: this.processingInterval !== null,
      isProcessing: this.isProcessing,
    };
  }
}

export const processingWorker = new ProcessingWorker();