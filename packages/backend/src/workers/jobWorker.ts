import { processingJobService } from '../services/processingJob.js';
import { FaceDetectionService } from '../services/faceDetectionService.js';
import { ImageProcessingService } from '../services/imageProcessingService.js';
import { ThemeService } from '../services/themeService.js';
import { GenderAdaptiveThemeService } from '../services/genderAdaptiveThemeService.js';
import { logger } from '../utils/logger.js';
import { metricsService } from '../services/metricsService.js';

export class JobWorker {
  private faceDetection = new FaceDetectionService();
  private imageProcessing = new ImageProcessingService();
  private themeService = new ThemeService();
  private genderService = new GenderAdaptiveThemeService();
  private isProcessing = false;

  async start(): Promise<void> {
    console.log('[WORKER] Job worker starting...');
    console.log('[WORKER] Environment variables:');
    console.log('  AWS_REGION:', process.env.AWS_REGION);
    console.log('  S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME);
    console.log('  PROCESSING_JOBS_TABLE:', process.env.PROCESSING_JOBS_TABLE);
    console.log('  THEMES_TABLE:', process.env.THEMES_TABLE);
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    logger.info('Job worker starting...');
    // Start processing immediately
    setImmediate(() => this.processJobs());
    console.log('[WORKER] Job worker started successfully');
    logger.info('Job worker started successfully');
  }

  private async processJobs(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      console.log('[WORKER] Checking for queued jobs...');
      const nextJob = await processingJobService.getNextQueuedJob();
      console.log(`[WORKER] getNextQueuedJob returned:`, nextJob ? `job ${nextJob.jobId}` : 'null');
      if (nextJob) {
        console.log(`[WORKER] Found queued job ${nextJob.jobId}, starting processing`);
        await this.processJob(nextJob.jobId);
        console.log(`[WORKER] Finished processing job ${nextJob.jobId}`);
      } else {
        console.log('[WORKER] No queued jobs found');
      }
    } catch (error) {
      console.log('[WORKER] Error in processJobs:', error);
      logger.error('Error processing jobs:', error);
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.processJobs(), 5000); // Check every 5 seconds
    }
  }

  async processJob(jobId: string): Promise<void> {
    const startTime = Date.now();
    console.log(`[WORKER] Starting to process job ${jobId}`);
    
    try {
      console.log(`[WORKER] Updating job ${jobId} status to processing`);
      await processingJobService.updateJobStatus(jobId, 'processing');
      
      console.log(`[WORKER] Getting job ${jobId} details`);
      const job = await processingJobService.getJob(jobId);
      if (!job) throw new Error('Job not found');
      console.log(`[WORKER] Job details:`, { jobId, originalImageUrl: job.originalImageUrl, themeId: job.themeId });

      console.log(`[WORKER] Getting theme ${job.themeId}`);
      const theme = await this.themeService.getThemeById(job.themeId);
      if (!theme) {
        console.log(`[WORKER] Theme ${job.themeId} not found in database`);
        throw new Error(`Theme not found: ${job.themeId}`);
      }
      console.log(`[WORKER] Theme found:`, { themeId: theme.id, variants: theme.variants?.length || 0 });
      
      if (!theme.variants || theme.variants.length === 0) {
        console.log(`[WORKER] Theme ${job.themeId} has no variants`);
        throw new Error(`Theme ${job.themeId} has no variants`);
      }

      console.log(`[WORKER] Starting face detection for ${job.originalImageUrl}`);
      const faceData = await this.faceDetection.detectFaces(job.originalImageUrl);
      if (!faceData.faces.length) throw new Error('No faces detected');
      console.log(`[WORKER] Face detection completed: ${faceData.faces.length} faces found`);

      // Select variant based on gender if not specified
      let variantId = job.variantId;
      if (!variantId && faceData.faces.length > 0) {
        console.log(`[WORKER] Selecting variant by gender`);
        const selection = await this.genderService.selectVariantByGender(theme.id, faceData);
        variantId = selection.recommendedVariantId;
      }
      if (!variantId) variantId = theme.variants[0].id;
      console.log(`[WORKER] Using variant: ${variantId}`);

      const variant = theme.variants.find(v => v.id === variantId);
      if (!variant) {
        console.log(`[WORKER] Variant ${variantId} not found in theme ${job.themeId}`);
        console.log(`[WORKER] Available variants:`, theme.variants.map(v => v.id));
        throw new Error(`Variant not found: ${variantId}`);
      }
      console.log(`[WORKER] Variant found:`, { variantId: variant.id, name: variant.name });

      console.log(`[WORKER] Starting image processing`);
      const result = await this.imageProcessing.processImage(
        job.originalImageUrl,
        {
          themeId: job.themeId,
          variantId,
          outputFormat: job.outputFormat || 'jpeg'
        }
      );
      console.log(`[WORKER] Image processing completed: ${result.resultImageUrl}`);

      const processingTime = Date.now() - startTime;
      console.log(`[WORKER] Updating job ${jobId} to completed status`);
      await processingJobService.updateJobStatus(jobId, 'completed', {
        resultImageUrl: result.resultImageUrl,
        processingTimeMs: processingTime
      });
      await metricsService.recordProcessingTime(processingTime);
      await metricsService.recordJobCount(1, 'completed');
      
      console.log(`[WORKER] Job ${jobId} completed successfully in ${processingTime}ms`);
      logger.info(`Job ${jobId} completed successfully`);
      
    } catch (error) {
      console.log(`[WORKER] Job ${jobId} failed with error:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[WORKER] Updating job ${jobId} to failed status with error: ${errorMessage}`);
      await processingJobService.updateJobStatus(jobId, 'failed', {
        error: errorMessage
      });
      await metricsService.recordJobCount(1, 'failed');
      logger.error(`Job ${jobId} failed:`, error);
    }
  }
}