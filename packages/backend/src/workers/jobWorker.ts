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
    logger.info('Job worker starting...');
    // Start processing immediately
    setImmediate(() => this.processJobs());
    logger.info('Job worker started successfully');
  }

  private async processJobs(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      logger.info('Worker checking for queued jobs using processingJobService');
      const nextJob = await processingJobService.getNextQueuedJob();
      if (nextJob) {
        logger.info(`Found queued job ${nextJob.jobId}`);
        await this.processJob(nextJob.jobId);
      } else {
        logger.info('No queued jobs found by processingJobService');
      }
    } catch (error) {
      logger.error('Error processing jobs:', error);
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.processJobs(), 5000); // Check every 5 seconds
    }
  }

  async processJob(jobId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await processingJobService.updateJobStatus(jobId, 'processing');
      
      const job = await processingJobService.getJob(jobId);
      if (!job) throw new Error('Job not found');

      // Get theme
      const theme = await this.themeService.getThemeById(job.themeId);
      if (!theme) throw new Error('Theme not found');

      // Detect faces and gender
      const faceData = await this.faceDetection.detectFaces(job.imageUrl);
      if (!faceData.faces.length) throw new Error('No faces detected');

      // Select variant based on gender if not specified
      let variantId = job.variantId;
      if (!variantId && faceData.faces.length > 0) {
        const selection = await this.genderService.selectVariantByGender(theme.id, faceData);
        variantId = selection.recommendedVariantId;
      }
      if (!variantId) variantId = theme.variants[0].id;

      const variant = theme.variants.find(v => v.id === variantId);
      if (!variant) throw new Error('Variant not found');

      // Process image
      const result = await this.imageProcessing.processImage(
        job.originalImageUrl || job.imageUrl || '',
        {
          themeId: job.themeId,
          variantId,
          outputFormat: job.outputFormat || 'jpeg'
        }
      );

      const processingTime = Date.now() - startTime;
      await processingJobService.updateJobStatus(jobId, 'completed', {
        resultImageUrl: result.resultImageUrl,
        processingTimeMs: processingTime
      });
      await metricsService.recordProcessingTime(processingTime);
      await metricsService.recordJobCount(1, 'completed');
      
      logger.info(`Job ${jobId} completed successfully`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await processingJobService.updateJobStatus(jobId, 'failed', {
        error: errorMessage
      });
      await metricsService.recordJobCount(1, 'failed');
      logger.error(`Job ${jobId} failed:`, error);
    }
  }
}