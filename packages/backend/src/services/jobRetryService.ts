import { JobQueueService } from './jobQueueService.js';
import { ProcessingJob } from 'shared/types/processing.js';
import { logger } from '../utils/logger.js';

export class JobRetryService {
  private jobQueue = new JobQueueService();
  private maxRetries = 3;
  private retryDelays = [5000, 15000, 60000]; // 5s, 15s, 1m

  async retryFailedJobs(): Promise<void> {
    try {
      const failedJobs = await this.getRetryableJobs();
      
      for (const job of failedJobs) {
        await this.scheduleRetry(job);
      }
    } catch (error) {
      logger.error('Error retrying failed jobs:', error);
    }
  }

  private async getRetryableJobs(): Promise<ProcessingJob[]> {
    // This would need a more sophisticated query in production
    // For now, we'll implement basic retry logic
    return [];
  }

  private async scheduleRetry(job: ProcessingJob): Promise<void> {
    const retryCount = (job as any).retryCount || 0;
    
    if (retryCount >= this.maxRetries) {
      logger.warn(`Job ${job.jobId} exceeded max retries`);
      return;
    }

    const delay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];
    
    setTimeout(async () => {
      try {
        await this.jobQueue.updateJobStatus(job.jobId, 'pending');
        logger.info(`Retrying job ${job.jobId} (attempt ${retryCount + 1})`);
      } catch (error) {
        logger.error(`Failed to retry job ${job.jobId}:`, error);
      }
    }, delay);
  }
}