import { ProcessingJob, ProcessingRequest } from 'shared';
import { processingJobService } from './processingJob.js';
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
      const job = await processingJobService.createJob(request);
      logger.info('Job enqueued', { jobId: job.id, themeId: request.themeId });
      
      // Immediately start processing (in a real system, this would be handled by a worker)
      this.processJobAsync(job.id);
      
      return job;
    } catch (error) {
      logger.error('Failed to enqueue job', { error, request });
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
      
      // Simulate processing (in real implementation, this would call the actual processing pipeline)
      await this.simulateProcessing(jobId);
      
    } catch (error) {
      logger.error('Job processing failed', { error, jobId });
      await this.handleJobFailure(jobId, error as Error);
    }
  }

  /**
   * Simulate image processing (placeholder for actual processing)
   */
  private async simulateProcessing(jobId: string): Promise<void> {
    const startTime = Date.now();
    
    // Simulate shorter processing time for demo (1-3 seconds)
    const processingTime = Math.random() * 2000 + 1000;
    
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          // Always succeed in demo mode
          const resultUrl = `https://via.placeholder.com/400x400?text=Processed+${jobId.substring(0, 8)}`;
          const processingTimeMs = Date.now() - startTime;
          
          await processingJobService.updateJobStatus(jobId, 'completed', {
            resultImageUrl: resultUrl,
            processingTimeMs,
          });
          
          logger.info('Job completed successfully (demo mode)', { jobId, processingTimeMs });
          resolve();
        } catch (error) {
          logger.warn('Job completion error ignored in demo mode', { error, jobId });
          resolve(); // Always resolve in demo mode
        }
      }, processingTime);
    });
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(jobId: string, error: Error): Promise<void> {
    try {
      const job = await processingJobService.getJob(jobId);
      if (!job) {
        logger.error('Job not found for failure handling', { jobId });
        return;
      }

      const newRetryCount = await processingJobService.incrementRetryCount(jobId);
      
      if (newRetryCount <= this.maxRetries) {
        // Schedule retry with exponential backoff
        const delay = this.calculateRetryDelay(newRetryCount);
        
        logger.info('Scheduling job retry', { 
          jobId, 
          retryCount: newRetryCount, 
          delayMs: delay,
          error: error.message 
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
          jobId, 
          retryCount: newRetryCount, 
          maxRetries: this.maxRetries,
          error: error.message 
        });
        
        await processingJobService.updateJobStatus(jobId, 'failed', {
          error: `Processing failed after ${this.maxRetries} retries: ${error.message}`,
        });
      }
    } catch (retryError) {
      logger.error('Failed to handle job failure', { 
        error: retryError, 
        jobId, 
        originalError: error.message 
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
      logger.info('Job retry cancelled', { jobId });
    }
  }

  /**
   * Clean up stuck jobs (jobs that have been processing too long)
   */
  async cleanupStuckJobs(olderThanMinutes = 30): Promise<void> {
    try {
      const stuckJobs = await processingJobService.getStuckJobs(olderThanMinutes);
      
      for (const job of stuckJobs) {
        logger.warn('Cleaning up stuck job', { 
          jobId: job.id, 
          status: job.status, 
          createdAt: job.createdAt 
        });
        
        await processingJobService.updateJobStatus(job.id, 'failed', {
          error: `Job timed out after ${olderThanMinutes} minutes`,
        });
      }
      
      if (stuckJobs.length > 0) {
        logger.info('Stuck jobs cleanup completed', { count: stuckJobs.length });
      }
    } catch (error) {
      logger.error('Failed to cleanup stuck jobs', { error });
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
      logger.error('Failed to get queue stats', { error });
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
      logger.info('Cancelled pending retry on shutdown', { jobId });
    }
    this.retryTimeouts.clear();
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();