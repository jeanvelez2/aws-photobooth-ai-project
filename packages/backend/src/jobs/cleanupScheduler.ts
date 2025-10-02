import cron from 'node-cron';
import { dataLifecycleService } from '../services/dataLifecycle.js';
import { logger } from '../utils/logger.js';

export class CleanupScheduler {
  private cleanupJob: cron.ScheduledTask | null = null;

  /**
   * Start the automated cleanup scheduler
   */
  start(): void {
    if (this.cleanupJob) {
      logger.warn('Cleanup scheduler is already running');
      return;
    }

    // Run cleanup every day at 2 AM
    this.cleanupJob = cron.schedule('0 2 * * *', async () => {
      logger.info('Starting scheduled data cleanup');
      
      try {
        const result = await dataLifecycleService.runAutomatedCleanup();
        
        logger.info('Scheduled cleanup completed successfully', {
          result,
          timestamp: new Date().toISOString(),
        });
        
        // Alert if cleanup had errors
        if (result.errors.length > 0) {
          logger.error('Cleanup completed with errors', {
            errors: result.errors,
            result,
          });
        }
      } catch (error) {
        logger.error('Scheduled cleanup failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'UTC',
    });

    this.cleanupJob.start();
    logger.info('Cleanup scheduler started - will run daily at 2 AM UTC');
  }

  /**
   * Stop the cleanup scheduler
   */
  stop(): void {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
      logger.info('Cleanup scheduler stopped');
    }
  }

  /**
   * Run cleanup immediately (for testing or manual triggers)
   */
  async runNow(): Promise<void> {
    logger.info('Running manual cleanup');
    
    try {
      const result = await dataLifecycleService.runAutomatedCleanup();
      
      logger.info('Manual cleanup completed', {
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Manual cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    nextRun: string | null;
    lastRun: string | null;
  } {
    return {
      isRunning: this.cleanupJob !== null,
      nextRun: this.cleanupJob ? 'Daily at 2:00 AM UTC' : null,
      lastRun: null, // This would need to be tracked separately
    };
  }
}

// Export singleton instance
export const cleanupScheduler = new CleanupScheduler();