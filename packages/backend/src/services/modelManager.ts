import { logger } from '../utils/logger.js';
import { modelStorageService, ModelMetadata } from './modelStorageService.js';
import { onnxRuntimeService, InferenceSession } from './onnxRuntimeService.js';
import { ThemeType } from './styleTransferEngine.js';

export interface ThemeModelConfig {
  theme: ThemeType;
  models: ModelConfig[];
  priority: number;
  memoryRequirement: number; // MB
  estimatedProcessingTime: number; // seconds
}

export interface ModelConfig {
  name: string;
  version: string;
  type: ModelType;
  framework: 'onnx' | 'pytorch' | 'tensorflow';
  inputSpecs: ModelInputSpec[];
  outputSpecs: ModelOutputSpec[];
  memoryRequirement: number; // MB
  processingTime: number; // seconds
  quality: 'fast' | 'balanced' | 'high';
  isRequired: boolean;
}

export enum ModelType {
  STYLE_TRANSFER = 'style_transfer',
  TEXTURE_ADAPTATION = 'texture_adaptation', 
  LIGHTING_ADAPTATION = 'lighting_adaptation',
  FACE_MESH_GENERATOR = 'face_mesh_generator',
  QUALITY_VALIDATOR = 'quality_validator'
}

export interface ModelInputSpec {
  name: string;
  shape: number[];
  dtype: 'float32' | 'uint8' | 'int32';
  description: string;
}

export interface ModelOutputSpec {
  name: string;
  shape: number[];
  dtype: 'float32' | 'uint8' | 'int32';
  description: string;
}

export interface LoadedModel {
  config: ModelConfig;
  session: InferenceSession;
  loadedAt: Date;
  lastUsed: Date;
  useCount: number;
}

export interface ModelLoadResult {
  success: boolean;
  loadedModels: LoadedModel[];
  failedModels: string[];
  totalLoadTime: number;
  memoryUsed: number;
}

/**
 * Model Manager
 * Handles loading, caching, and management of theme-specific neural network models
 */
export class ModelManager {
  private loadedModels: Map<string, LoadedModel> = new Map();
  private themeConfigs: Map<ThemeType, ThemeModelConfig> = new Map();
  private maxConcurrentModels: number = 8;
  private modelTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.initializeThemeConfigs();
    this.startModelCleanup();
  }

  /**
   * Load models for a specific theme
   */
  async loadThemeModels(theme: ThemeType, quality: 'fast' | 'balanced' | 'high' = 'balanced'): Promise<ModelLoadResult> {
    const startTime = Date.now();
    logger.info('Loading theme models', { theme, quality });

    const themeConfig = this.themeConfigs.get(theme);
    if (!themeConfig) {
      throw new Error(`Theme configuration not found: ${theme}`);
    }

    const loadedModels: LoadedModel[] = [];
    const failedModels: string[] = [];
    let totalMemoryUsed = 0;

    // Filter models by quality level
    const modelsToLoad = themeConfig.models.filter(model => 
      model.quality === quality || model.isRequired
    );

    // Load models in parallel with concurrency limit
    const loadPromises = modelsToLoad.map(async (modelConfig) => {
      try {
        const modelKey = this.getModelKey(theme, modelConfig.name, modelConfig.version);
        
        // Check if already loaded
        if (this.loadedModels.has(modelKey)) {
          const existing = this.loadedModels.get(modelKey)!;
          existing.lastUsed = new Date();
          existing.useCount++;
          loadedModels.push(existing);
          return;
        }

        // Load new model
        const session = await onnxRuntimeService.loadModel(
          modelConfig.name, 
          theme, 
          modelConfig.version
        );

        const loadedModel: LoadedModel = {
          config: modelConfig,
          session,
          loadedAt: new Date(),
          lastUsed: new Date(),
          useCount: 1
        };

        this.loadedModels.set(modelKey, loadedModel);
        loadedModels.push(loadedModel);
        totalMemoryUsed += modelConfig.memoryRequirement;

        logger.debug('Model loaded successfully', {
          theme,
          modelName: modelConfig.name,
          memoryUsed: modelConfig.memoryRequirement
        });

      } catch (error) {
        logger.error('Failed to load model', {
          theme,
          modelName: modelConfig.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failedModels.push(modelConfig.name);
      }
    });

    await Promise.allSettled(loadPromises);

    const totalLoadTime = Date.now() - startTime;
    
    logger.info('Theme models loading completed', {
      theme,
      quality,
      loadedCount: loadedModels.length,
      failedCount: failedModels.length,
      totalLoadTime,
      memoryUsed: totalMemoryUsed
    });

    return {
      success: failedModels.length === 0,
      loadedModels,
      failedModels,
      totalLoadTime,
      memoryUsed: totalMemoryUsed
    };
  }

  /**
   * Get a loaded model for inference
   */
  async getModel(theme: ThemeType, modelType: ModelType, quality: 'fast' | 'balanced' | 'high' = 'balanced'): Promise<LoadedModel> {
    const themeConfig = this.themeConfigs.get(theme);
    if (!themeConfig) {
      throw new Error(`Theme configuration not found: ${theme}`);
    }

    // Find matching model config
    const modelConfig = themeConfig.models.find(m => 
      m.type === modelType && (m.quality === quality || m.isRequired)
    );

    if (!modelConfig) {
      throw new Error(`Model not found: ${theme}/${modelType}/${quality}`);
    }

    const modelKey = this.getModelKey(theme, modelConfig.name, modelConfig.version);
    
    // Check if already loaded
    if (this.loadedModels.has(modelKey)) {
      const model = this.loadedModels.get(modelKey)!;
      model.lastUsed = new Date();
      model.useCount++;
      return model;
    }

    // Load model if not already loaded
    await this.loadThemeModels(theme, quality);
    
    const loadedModel = this.loadedModels.get(modelKey);
    if (!loadedModel) {
      throw new Error(`Failed to load model: ${modelKey}`);
    }

    return loadedModel;
  }

  /**
   * Preload models for faster processing
   */
  async preloadModels(themes: ThemeType[], quality: 'fast' | 'balanced' | 'high' = 'balanced'): Promise<void> {
    logger.info('Preloading models', { themes, quality });

    const preloadPromises = themes.map(async (theme) => {
      try {
        await this.loadThemeModels(theme, quality);
      } catch (error) {
        logger.error('Failed to preload theme models', {
          theme,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.allSettled(preloadPromises);
    logger.info('Model preloading completed');
  }

  /**
   * Get model statistics
   */
  getModelStats(): {
    totalModels: number;
    modelsByTheme: Record<string, number>;
    memoryUsage: number;
    oldestModel: Date | null;
    mostUsedModel: string | null;
  } {
    let totalMemory = 0;
    let oldestModel: Date | null = null;
    let mostUsedModel: string | null = null;
    let maxUseCount = 0;
    
    const modelsByTheme: Record<string, number> = {};

    for (const [key, model] of this.loadedModels.entries()) {
      // Count by theme
      const theme = key.split('/')[0];
      modelsByTheme[theme] = (modelsByTheme[theme] || 0) + 1;
      
      // Calculate memory usage
      totalMemory += model.config.memoryRequirement;
      
      // Find oldest model
      if (!oldestModel || model.loadedAt < oldestModel) {
        oldestModel = model.loadedAt;
      }
      
      // Find most used model
      if (model.useCount > maxUseCount) {
        maxUseCount = model.useCount;
        mostUsedModel = key;
      }
    }

    return {
      totalModels: this.loadedModels.size,
      modelsByTheme,
      memoryUsage: totalMemory,
      oldestModel,
      mostUsedModel
    };
  }

  /**
   * Clear models for specific theme or all models
   */
  async clearModels(theme?: ThemeType): Promise<void> {
    const modelsToRemove: string[] = [];

    for (const [key, model] of this.loadedModels.entries()) {
      if (!theme || key.startsWith(theme + '/')) {
        modelsToRemove.push(key);
        
        try {
          await model.session.session.release();
        } catch (error) {
          logger.warn('Failed to release model session', { key, error });
        }
      }
    }

    for (const key of modelsToRemove) {
      this.loadedModels.delete(key);
    }

    logger.info('Models cleared', {
      theme: theme || 'all',
      clearedCount: modelsToRemove.length
    });
  }

  /**
   * Initialize theme configurations
   */
  private initializeThemeConfigs(): void {
    // Barbarian theme models
    this.themeConfigs.set('barbarian', {
      theme: 'barbarian',
      priority: 1,
      memoryRequirement: 2048, // 2GB
      estimatedProcessingTime: 15, // seconds
      models: [
        {
          name: 'barbarian-style-transfer',
          version: 'latest',
          type: ModelType.STYLE_TRANSFER,
          framework: 'onnx',
          inputSpecs: [
            { name: 'input_image', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Input face image' },
            { name: 'style_vector', shape: [1, 256], dtype: 'float32', description: 'Style embedding vector' }
          ],
          outputSpecs: [
            { name: 'styled_image', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Styled output image' }
          ],
          memoryRequirement: 1024,
          processingTime: 8,
          quality: 'balanced',
          isRequired: true
        },
        {
          name: 'barbarian-texture-enhancer',
          version: 'latest',
          type: ModelType.TEXTURE_ADAPTATION,
          framework: 'onnx',
          inputSpecs: [
            { name: 'face_image', shape: [1, 3, 256, 256], dtype: 'float32', description: 'Face region image' }
          ],
          outputSpecs: [
            { name: 'textured_face', shape: [1, 3, 256, 256], dtype: 'float32', description: 'Enhanced texture face' }
          ],
          memoryRequirement: 512,
          processingTime: 3,
          quality: 'high',
          isRequired: false
        },
        {
          name: 'barbarian-lighting-adapter',
          version: 'latest',
          type: ModelType.LIGHTING_ADAPTATION,
          framework: 'onnx',
          inputSpecs: [
            { name: 'face_image', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Textured face image' },
            { name: 'lighting_conditions', shape: [1, 16], dtype: 'float32', description: 'Lighting analysis vector' }
          ],
          outputSpecs: [
            { name: 'lit_face', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Dramatically lit face' }
          ],
          memoryRequirement: 384,
          processingTime: 2,
          quality: 'balanced',
          isRequired: false
        }
      ]
    });

    // Greek theme models
    this.themeConfigs.set('greek', {
      theme: 'greek',
      priority: 2,
      memoryRequirement: 1536, // 1.5GB
      estimatedProcessingTime: 12,
      models: [
        {
          name: 'greek-classical-style',
          version: 'latest',
          type: ModelType.STYLE_TRANSFER,
          framework: 'onnx',
          inputSpecs: [
            { name: 'input_image', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Input face image' }
          ],
          outputSpecs: [
            { name: 'classical_image', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Classical styled image' }
          ],
          memoryRequirement: 896,
          processingTime: 6,
          quality: 'balanced',
          isRequired: true
        }
      ]
    });

    // Mystic theme models
    this.themeConfigs.set('mystic', {
      theme: 'mystic',
      priority: 3,
      memoryRequirement: 2560, // 2.5GB
      estimatedProcessingTime: 18,
      models: [
        {
          name: 'mystic-ethereal-style',
          version: 'latest',
          type: ModelType.STYLE_TRANSFER,
          framework: 'onnx',
          inputSpecs: [
            { name: 'input_image', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Input face image' }
          ],
          outputSpecs: [
            { name: 'ethereal_image', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Ethereal styled image' }
          ],
          memoryRequirement: 1280,
          processingTime: 10,
          quality: 'balanced',
          isRequired: true
        }
      ]
    });

    // Anime theme models
    this.themeConfigs.set('anime', {
      theme: 'anime',
      priority: 4,
      memoryRequirement: 1792, // 1.75GB
      estimatedProcessingTime: 10,
      models: [
        {
          name: 'anime-style-transfer',
          version: 'latest',
          type: ModelType.STYLE_TRANSFER,
          framework: 'onnx',
          inputSpecs: [
            { name: 'input_image', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Input face image' }
          ],
          outputSpecs: [
            { name: 'anime_image', shape: [1, 3, 512, 512], dtype: 'float32', description: 'Anime styled image' }
          ],
          memoryRequirement: 1024,
          processingTime: 5,
          quality: 'balanced',
          isRequired: true
        }
      ]
    });

    logger.info('Theme model configurations initialized', {
      themes: Array.from(this.themeConfigs.keys()),
      totalConfigs: this.themeConfigs.size
    });
  }

  /**
   * Generate model key for caching
   */
  private getModelKey(theme: ThemeType, modelName: string, version: string): string {
    return `${theme}/${modelName}/${version}`;
  }

  /**
   * Start periodic model cleanup
   */
  private startModelCleanup(): void {
    setInterval(() => {
      this.cleanupUnusedModels().catch(error => {
        logger.error('Model cleanup failed', { error });
      });
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Clean up unused models
   */
  private async cleanupUnusedModels(): Promise<void> {
    const now = Date.now();
    const modelsToRemove: string[] = [];

    for (const [key, model] of this.loadedModels.entries()) {
      const timeSinceLastUse = now - model.lastUsed.getTime();
      
      if (timeSinceLastUse > this.modelTimeout) {
        modelsToRemove.push(key);
      }
    }

    for (const key of modelsToRemove) {
      const model = this.loadedModels.get(key);
      if (model) {
        try {
          await model.session.session.release();
          this.loadedModels.delete(key);
          
          logger.info('Cleaned up unused model', {
            modelKey: key,
            lastUsed: model.lastUsed,
            useCount: model.useCount
          });
        } catch (error) {
          logger.error('Failed to cleanup model', { key, error });
        }
      }
    }
  }
}