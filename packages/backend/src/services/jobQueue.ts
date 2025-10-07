import { ProcessingJob, ProcessingRequest } from 'shared';
import { processingJobService } from './processingJob.js';
import { imageProcessingService } from './imageProcessingService.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface JobQueueOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class JobQueue {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly retryTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(options: JobQueueOptions = {}) {
    this.maxRetries = options.maxRetries ?? config.processing.maxRetries;
    this.baseDelayMs = options.baseDelayMs ?? 1000; // 1 second base delay
    this.maxDelayMs = options.maxDelayMs ?? 30000; // 30 seconds max delay
  }

  /**
   * Add a new job to the queue
   */
  async enqueueJob(request: ProcessingRequest): Promise<ProcessingJob> {
    try {
      logger.info('Enqueueing job', {
        photoId: request.photoId,
        themeId: request.themeId,
        originalImageUrlType: request.originalImageUrl.startsWith('data:') ? 'base64' : 'url',
        originalImageUrlLength: request.originalImageUrl.length
      });
      
      const job = await processingJobService.createJob(request);
      logger.info('Job enqueued', { 
        jobId: job.jobId?.replace(/[\r\n\t]/g, '') || 'unknown', 
        themeId: request.themeId?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      
      // Immediately start processing (in a real system, this would be handled by a worker)
      this.processJobAsync(job.jobId);
      
      return job;
    } catch (error) {
      logger.error('Failed to enqueue job', { 
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
        themeId: request.themeId?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ProcessingJob | null> {
    return processingJobService.getJob(jobId);
  }

  /**
   * Process a job asynchronously (simulated processing for now)
   */
  private async processJobAsync(jobId: string): Promise<void> {
    try {
      // Update status to processing
      await processingJobService.updateJobStatus(jobId, 'processing');
      
      // Process the image
      await this.processImage(jobId);
      
    } catch (error) {
      logger.error('Job processing failed', { 
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error',
        jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
      await this.handleJobFailure(jobId, error as Error);
    }
  }

  /**
   * Process image using the image processing service
   */
  private async processImage(jobId: string): Promise<void> {
    const job = await processingJobService.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Extract S3 key from originalImageUrl (or upload if base64)
    const imageKey = await this.extractS3KeyFromUrl(job.originalImageUrl);
    
    const result = await imageProcessingService.processImage(imageKey, {
      themeId: job.themeId,
      variantId: job.variantId,
      outputFormat: job.outputFormat as 'jpeg' | 'png',
      action: (job as any).action,
      mood: (job as any).mood,
      generatePose: (job as any).generatePose,
    });

    await processingJobService.updateJobStatus(jobId, 'completed', {
      resultImageUrl: result.resultImageUrl,
      processingTimeMs: result.processingTimeMs,
    });

    logger.info('Job completed successfully', {
      jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown',
      processingTimeMs: result.processingTimeMs,
      faceCount: result.faceCount,
    });
  }

  private async extractS3KeyFromUrl(url: string): Promise<string> {
    logger.info('Extracting S3 key from URL', {
      urlType: url.startsWith('data:') ? 'base64' : 'url',
      urlLength: url.length,
      urlPrefix: url.substring(0, 50)
    });
    
    // Handle data URLs by uploading to S3 first
    if (url.startsWith('data:')) {
      logger.warn('Received base64 data URL, uploading to S3 as fallback', {
        dataUrlSize: Math.round(url.length / 1024) + 'KB'
      });
      return await this.uploadBase64ToS3(url);
    }
    
    // Extract key from S3 URL patterns:
    // https://bucket.s3.amazonaws.com/uploads/anonymous/key.jpg
    let match = url.match(/[^/]+\.s3\.amazonaws\.com\/(.+)$/);
    if (match) {
      logger.info('Extracted S3 key from bucket URL', { key: match[1] });
      return match[1]; // Returns full path like "uploads/anonymous/key.jpg"
    }
    
    // Try https://s3.amazonaws.com/bucket/key pattern
    match = url.match(/s3\.amazonaws\.com\/[^/]+\/(.+)$/);
    if (match) {
      logger.info('Extracted S3 key from s3 URL', { key: match[1] });
      return match[1];
    }
    
    logger.error('Failed to extract S3 key from URL', { url: url.substring(0, 100) });
    throw new Error(`Unable to extract S3 key from URL: ${url.substring(0, 100)}...`);
  }
  
  private async uploadBase64ToS3(dataUrl: string): Promise<string> {
    logger.info('Starting base64 to S3 upload');
    
    try {
      const { v4: uuidv4 } = await import('uuid');
      
      // Extract base64 data and mime type
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        logger.error('Invalid data URL format');
        throw new Error('Invalid data URL format');
      }
      
      const [, mimeType, base64Data] = matches;
      logger.info('Parsed data URL', {
        mimeType,
        base64Size: Math.round(base64Data.length / 1024) + 'KB'
      });
      
      const buffer = Buffer.from(base64Data, 'base64');
      logger.info('Created buffer', { bufferSize: Math.round(buffer.length / 1024) + 'KB' });
      
      // Generate S3 key
      const extension = mimeType.split('/')[1] || 'jpg';
      const key = `uploads/fallback/${uuidv4()}.${extension}`;
      
      logger.info('Generated S3 key', { key, extension });
      
      // Upload to S3
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const s3Client = new S3Client({ region: config.aws.region });
      
      logger.info('Uploading to S3', {
        bucket: config.aws.s3.bucketName,
        key,
        contentType: mimeType
      });
      
      await s3Client.send(new PutObjectCommand({
        Bucket: config.aws.s3.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          uploadedAt: new Date().toISOString(),
          source: 'fallback-base64',
        },
      }));
      
      logger.info('Base64 data uploaded to S3 successfully', { key });
      return key;
    } catch (error) {
      logger.error('Failed to upload base64 to S3', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(jobId: string, error: Error): Promise<void> {
    try {
      const job = await processingJobService.getJob(jobId);
      if (!job) {
        logger.error('Job not found for failure handling', { 
          jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown'
        });
        return;
      }

      const newRetryCount = await processingJobService.incrementRetryCount(jobId);
      
      if (newRetryCount <= this.maxRetries) {
        // Schedule retry with exponential backoff
        const delay = this.calculateRetryDelay(newRetryCount);
        
        logger.info('Scheduling job retry', { 
          jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown', 
          retryCount: newRetryCount, 
          delayMs: delay,
          error: error.message?.replace(/[\r\n\t]/g, '') || 'Unknown error'
        });
        
        // Update status back to queued for retry
        await processingJobService.updateJobStatus(jobId, 'queued');
        
        // Schedule retry
        const timeoutId = setTimeout(() => {
          this.retryTimeouts.delete(jobId);
          this.processJobAsync(jobId);
        }, delay);
        
        this.retryTimeouts.set(jobId, timeoutId);
      } else {
        // Max retries exceeded, mark as failed
        logger.error('Job failed after max retries', { 
          jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown', 
          retryCount: newRetryCount, 
          maxRetries: this.maxRetries,
          error: error.message?.replace(/[\r\n\t]/g, '') || 'Unknown error'
        });
        
        await processingJobService.updateJobStatus(jobId, 'failed', {
          error: `Processing failed after ${this.maxRetries} retries: ${error.message}`,
        });
      }
    } catch (retryError) {
      logger.error('Failed to handle job failure', { 
        error: retryError instanceof Error ? retryError.message.replace(/[\r\n\t]/g, '') : 'Unknown error', 
        jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown', 
        originalError: error.message?.replace(/[\r\n\t]/g, '') || 'Unknown error'
      });
    }
  }

  /**
   * Calculate retry delay using exponential backoff with jitter
   */
  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: baseDelay * 2^(retryCount-1)
    const exponentialDelay = this.baseDelayMs * Math.pow(2, retryCount - 1);
    
    // Add jitter (±25% randomization)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    const delayWithJitter = exponentialDelay + jitter;
    
    // Cap at maximum delay
    return Math.min(delayWithJitter, this.maxDelayMs);
  }

  /**
   * Cancel a job retry (if scheduled)
   */
  async cancelJobRetry(jobId: string): Promise<void> {
    const timeoutId = this.retryTimeouts.get(jobId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.retryTimeouts.delete(jobId);
      logger.info('Job retry cancelled', { 
        jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
    }
  }

  /**
   * Clean up stuck jobs (jobs that have been processing too long)
   */
  async cleanupStuckJobs(olderThanMinutes = 30): Promise<void> {
    try {
      const stuckJobs = await processingJobService.getStuckJobs(olderThanMinutes);
      
      for (const job of stuckJobs) {
        try {
          logger.warn('Cleaning up stuck job', { 
            jobId: job.jobId?.replace(/[\r\n\t]/g, '') || 'unknown', 
            status: job.status?.replace(/[\r\n\t]/g, '') || 'unknown', 
            createdAt: job.createdAt 
          });
          
          await processingJobService.updateJobStatus(job.jobId, 'failed', {
            error: `Job timed out after ${olderThanMinutes} minutes`,
          });
        } catch (jobError) {
          logger.error('Failed to cleanup individual stuck job', {
            jobId: job.jobId,
            error: jobError instanceof Error ? jobError.message : 'Unknown error'
          });
        }
      }
      
      if (stuckJobs.length > 0) {
        logger.info('Stuck jobs cleanup completed', { count: stuckJobs.length });
      }
    } catch (error) {
      logger.error('Failed to cleanup stuck jobs', { 
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
      });
      // Don't throw - allow service to continue running
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [queued, processing, completed, failed] = await Promise.all([
        processingJobService.getJobsByStatus('queued', 1000),
        processingJobService.getJobsByStatus('processing', 1000),
        processingJobService.getJobsByStatus('completed', 1000),
        processingJobService.getJobsByStatus('failed', 1000),
      ]);

      return {
        queued: queued.length,
        processing: processing.length,
        completed: completed.length,
        failed: failed.length,
      };
    } catch (error) {
      logger.error('Failed to get queue stats', { 
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Shutdown the queue gracefully
   */
  shutdown(): void {
    // Clear all pending retries
    for (const [jobId, timeoutId] of this.retryTimeouts.entries()) {
      clearTimeout(timeoutId);
      logger.info('Cancelled pending retry on shutdown', { 
        jobId: jobId?.replace(/[\r\n\t]/g, '') || 'unknown'
      });
    }
    this.retryTimeouts.clear();
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();