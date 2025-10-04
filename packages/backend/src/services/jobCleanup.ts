import { processingJobService } from './processingJob.js';
import { jobQueue } from './jobQueue.js';
import { logger } from '../utils/logger.js';

export class JobCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;

  constructor(intervalMinutes = 30) {
    this.intervalMs = intervalMinutes * 60 * 1000;
  }

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.cleanupInterval) {
      logger.warn('Job cleanup service is already running');
      return;
    }

    logger.info('Starting job cleanup service', { intervalMinutes: this.intervalMs / 60000 });

    // Run cleanup immediately
    this.runCleanup();

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.intervalMs);
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Job cleanup service stopped');
    }
  }

  /**
   * Run cleanup tasks
   */
  private async runCleanup(): Promise<void> {
    try {
      logger.info('Starting job cleanup cycle');

      // Clean up stuck jobs (jobs processing for more than 30 minutes)
      await jobQueue.cleanupStuckJobs(30);

      // Clean up old failed jobs (older than 24 hours)
      await this.cleanupOldFailedJobs(24);

      // Log queue statistics
      await this.logQueueStatistics();

      logger.info('Job cleanup cycle completed');
    } catch (error) {
      logger.error('Job cleanup cycle failed', { error });
    }
  }

  /**
   * Clean up old failed jobs
   */
  private async cleanupOldFailedJobs(olderThanHours: number): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      const failedJobs = await processingJobService.getJobsByStatus('failed', 1000);

      let cleanedCount = 0;
      for (const job of failedJobs) {
        if (new Date(job.createdAt) < cutoffTime) {
          await processingJobService.deleteJob(job.jobId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up old failed jobs', { 
          count: cleanedCount, 
          olderThanHours 
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup old failed jobs', { 
        error: error instanceof Error ? error.message.replace(/[\r\n\t]/g, '') : 'Unknown error', 
        olderThanHours 
      });
    }
  }

  /**
   * Log current queue statistics for monitoring
   */
  private async logQueueStatistics(): Promise<void> {
    try {
      const stats = await jobQueue.getQueueStats();
      const total = stats.queued + stats.processing + stats.completed + stats.failed;

      logger.info('Current queue statistics', {
        ...stats,
        total,
        successRate: total > 0 ? ((stats.completed / total) * 100).toFixed(2) + '%' : 'N/A',
      });
    } catch (error) {
      logger.error('Failed to log queue statistics', { error });
    }
  }

  /**
   * Perform manual cleanup (for testing or manual operations)
   */
  async manualCleanup(options: {
    cleanupStuckJobs?: boolean;
    cleanupOldFailedJobs?: boolean;
    stuckJobsMinutes?: number;
    oldJobsHours?: number;
  } = {}): Promise<void> {
    const {
      cleanupStuckJobs = true,
      cleanupOldFailedJobs = true,
      stuckJobsMinutes = 30,
      oldJobsHours = 24,
    } = options;

    logger.info('Starting manual cleanup', options);

    try {
      if (cleanupStuckJobs) {
        await jobQueue.cleanupStuckJobs(stuckJobsMinutes);
      }

      if (cleanupOldFailedJobs) {
        await this.cleanupOldFailedJobs(oldJobsHours);
      }

      await this.logQueueStatistics();

      logger.info('Manual cleanup completed successfully');
    } catch (error) {
      logger.error('Manual cleanup failed', { error, options });
      throw error;
    }
  }

  /**
   * Get cleanup service status
   */
  getStatus(): {
    isRunning: boolean;
    intervalMs: number;
    nextCleanupIn?: number;
  } {
    return {
      isRunning: this.cleanupInterval !== null,
      intervalMs: this.intervalMs,
      // Note: We can't easily calculate nextCleanupIn with setInterval
      // In a production system, you might want to use a more sophisticated scheduler
    };
  }
}

// Export singleton instance
export const jobCleanupService = new JobCleanupService();