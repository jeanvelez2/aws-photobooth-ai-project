import { JobWorker } from './jobWorker.js';
import { JobRetryService } from '../services/jobRetryService.js';
import { JobCleanupService } from '../services/jobCleanupService.js';
import { logger } from '../utils/logger.js';
import cron from 'node-cron';

const jobWorker = new JobWorker();
const retryService = new JobRetryService();
const cleanupService = new JobCleanupService();

export async function startWorkers(): Promise<void> {
  logger.info('Starting background workers...');

  // Start job processing worker
  await jobWorker.start();

  // Schedule retry service (every 5 minutes)
  cron.schedule('*/5 * * * *', async () => {
    await retryService.retryFailedJobs();
  });

  // Schedule cleanup service (daily at 2 AM)
  cron.schedule('0 2 * * *', async () => {
    await cleanupService.cleanupOldJobs();
  });

  logger.info('Background workers started successfully');
}

export { JobWorker, JobRetryService, JobCleanupService };