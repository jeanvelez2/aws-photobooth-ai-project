import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { logger } from '../utils/logger.js';

export interface ModelMetadata {
  modelName: string;
  version: string;
  theme: string;
  framework: 'pytorch' | 'onnx' | 'tensorflow';
  size: number;
  checksum: string;
  lastModified: Date;
}

export interface ModelCacheEntry {
  metadata: ModelMetadata;
  localPath: string;
  lastAccessed: Date;
  downloadedAt: Date;
}

export class ModelStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private localCacheDir: string;
  private modelCache: Map<string, ModelCacheEntry> = new Map();
  private maxCacheSize: number = 10 * 1024 * 1024 * 1024; // 10GB
  private cacheCleanupInterval: number = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    this.bucketName = process.env.S3_BUCKET_NAME!;
    this.localCacheDir = process.env.MODEL_CACHE_DIR || '/tmp/models';
    
    // Ensure cache directory exists
    this.ensureCacheDirectory();
    
    // Start periodic cache cleanup
    this.startCacheCleanup();
  }

  /**
   * Get model from cache or download from S3
   */
  async getModel(modelName: string, theme: string, version: string = 'latest'): Promise<string> {
    const cacheKey = `${theme}/${modelName}/${version}`;
    
    try {
      // Check if model exists in cache and is valid
      if (this.modelCache.has(cacheKey)) {
        const cacheEntry = this.modelCache.get(cacheKey)!;
        
        // Verify local file still exists
        if (existsSync(cacheEntry.localPath)) {
          // Update last accessed time
          cacheEntry.lastAccessed = new Date();
          logger.info(`Model loaded from cache: ${cacheKey}`);
          return cacheEntry.localPath;
        } else {
          // Remove invalid cache entry
          this.modelCache.delete(cacheKey);
        }
      }

      // Download model from S3
      const localPath = await this.downloadModel(modelName, theme, version);
      
      logger.info(`Model downloaded and cached: ${cacheKey}`);
      return localPath;
      
    } catch (error) {
      logger.error(`Failed to get model ${cacheKey}:`, error);
      throw new Error(`Model loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download model from S3 and cache locally
   */
  private async downloadModel(modelName: string, theme: string, version: string): Promise<string> {
    const s3Key = `models/${theme}/${modelName}/${version}/${modelName}.onnx`;
    const localPath = join(this.localCacheDir, theme, modelName, version, `${modelName}.onnx`);
    
    try {
      // Get model metadata from S3
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });
      
      const headResponse = await this.s3Client.send(headCommand);
      
      // Ensure local directory exists
      const localDir = dirname(localPath);
      if (!existsSync(localDir)) {
        mkdirSync(localDir, { recursive: true });
      }

      // Download model file
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });
      
      const response = await this.s3Client.send(getCommand);
      
      if (!response.Body) {
        throw new Error('Empty response body from S3');
      }

      // Stream download to local file
      const writeStream = createWriteStream(localPath);
      await pipeline(response.Body as NodeJS.ReadableStream, writeStream);

      // Create cache entry
      const metadata: ModelMetadata = {
        modelName,
        version,
        theme,
        framework: 'onnx',
        size: headResponse.ContentLength || 0,
        checksum: headResponse.ETag || '',
        lastModified: headResponse.LastModified || new Date(),
      };

      const cacheEntry: ModelCacheEntry = {
        metadata,
        localPath,
        lastAccessed: new Date(),
        downloadedAt: new Date(),
      };

      const cacheKey = `${theme}/${modelName}/${version}`;
      this.modelCache.set(cacheKey, cacheEntry);

      // Check if cache cleanup is needed
      await this.cleanupCacheIfNeeded();

      return localPath;
      
    } catch (error) {
      logger.error(`Failed to download model from S3: ${s3Key}`, error);
      throw error;
    }
  }

  /**
   * List available models for a theme
   */
  async listModels(theme: string): Promise<ModelMetadata[]> {
    // This would typically query S3 to list available models
    // For now, return a static list based on the theme
    const models: ModelMetadata[] = [];
    
    const themeModels = {
      barbarian: ['barbarian-style-transfer', 'barbarian-texture-enhancer'],
      greek: ['greek-classical-style', 'greek-proportion-adjuster'],
      mystic: ['mystic-ethereal-style', 'mystic-glow-enhancer'],
      anime: ['anime-style-transfer', 'anime-eye-enhancer'],
    };

    const modelNames = themeModels[theme as keyof typeof themeModels] || [];
    
    for (const modelName of modelNames) {
      models.push({
        modelName,
        version: 'latest',
        theme,
        framework: 'onnx',
        size: 0, // Would be populated from S3 metadata
        checksum: '',
        lastModified: new Date(),
      });
    }

    return models;
  }

  /**
   * Preload models for faster access
   */
  async preloadModels(theme: string): Promise<void> {
    try {
      const models = await this.listModels(theme);
      
      const preloadPromises = models.map(async (model) => {
        try {
          await this.getModel(model.modelName, model.theme, model.version);
          logger.info(`Preloaded model: ${model.theme}/${model.modelName}`);
        } catch (error) {
          logger.warn(`Failed to preload model ${model.theme}/${model.modelName}:`, error);
        }
      });

      await Promise.allSettled(preloadPromises);
      logger.info(`Preloading completed for theme: ${theme}`);
      
    } catch (error) {
      logger.error(`Failed to preload models for theme ${theme}:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalModels: number;
    totalSize: number;
    oldestModel: Date | null;
    newestModel: Date | null;
  } {
    let totalSize = 0;
    let oldestModel: Date | null = null;
    let newestModel: Date | null = null;

    for (const entry of this.modelCache.values()) {
      totalSize += entry.metadata.size;
      
      if (!oldestModel || entry.downloadedAt < oldestModel) {
        oldestModel = entry.downloadedAt;
      }
      
      if (!newestModel || entry.downloadedAt > newestModel) {
        newestModel = entry.downloadedAt;
      }
    }

    return {
      totalModels: this.modelCache.size,
      totalSize,
      oldestModel,
      newestModel,
    };
  }

  /**
   * Clear cache for specific model or all models
   */
  async clearCache(modelKey?: string): Promise<void> {
    if (modelKey) {
      const entry = this.modelCache.get(modelKey);
      if (entry && existsSync(entry.localPath)) {
        // In a real implementation, you'd delete the file
        // For now, just remove from cache
        this.modelCache.delete(modelKey);
        logger.info(`Cleared cache for model: ${modelKey}`);
      }
    } else {
      this.modelCache.clear();
      logger.info('Cleared all model cache');
    }
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDirectory(): void {
    if (!existsSync(this.localCacheDir)) {
      mkdirSync(this.localCacheDir, { recursive: true });
      logger.info(`Created model cache directory: ${this.localCacheDir}`);
    }
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCacheIfNeeded().catch((error) => {
        logger.error('Cache cleanup failed:', error);
      });
    }, this.cacheCleanupInterval);
  }

  /**
   * Cleanup cache if it exceeds size limit
   */
  private async cleanupCacheIfNeeded(): Promise<void> {
    const stats = this.getCacheStats();
    
    if (stats.totalSize > this.maxCacheSize) {
      logger.info(`Cache size (${stats.totalSize}) exceeds limit (${this.maxCacheSize}), cleaning up...`);
      
      // Sort by last accessed time (oldest first)
      const sortedEntries = Array.from(this.modelCache.entries())
        .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
      
      // Remove oldest entries until under limit
      let currentSize = stats.totalSize;
      for (const [key, entry] of sortedEntries) {
        if (currentSize <= this.maxCacheSize * 0.8) { // Clean to 80% of limit
          break;
        }
        
        this.modelCache.delete(key);
        currentSize -= entry.metadata.size;
        logger.info(`Removed cached model: ${key}`);
      }
    }
  }
}

// Singleton instance
export const modelStorageService = new ModelStorageService();