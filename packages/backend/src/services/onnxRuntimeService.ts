import * as ort from 'onnxruntime-node';
import { modelStorageService, ModelMetadata } from './modelStorageService.js';
import { logger } from '../utils/logger.js';

export interface InferenceSession {
  session: ort.InferenceSession;
  metadata: ModelMetadata;
  lastUsed: Date;
}

export interface ModelInput {
  data: Float32Array;
  dims: number[];
  type: 'float32';
}

export interface ModelOutput {
  data: Float32Array;
  dims: number[];
}

export class OnnxRuntimeService {
  private sessions: Map<string, InferenceSession> = new Map();
  private maxSessions: number = 4; // Limit concurrent sessions for memory management
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Configure ONNX Runtime
    this.configureOnnxRuntime();
    
    // Start session cleanup
    this.startSessionCleanup();
  }

  /**
   * Configure ONNX Runtime settings
   */
  private configureOnnxRuntime(): void {
    // Set execution providers (GPU first, then CPU fallback)
    const executionProviders: ort.ExecutionProvider[] = [];
    
    // Check if CUDA is available
    if (process.env.CUDA_VISIBLE_DEVICES && process.env.NVIDIA_VISIBLE_DEVICES) {
      executionProviders.push('cuda');
      logger.info('CUDA execution provider enabled');
    }
    
    // Always include CPU as fallback
    executionProviders.push('cpu');
    
    // Set global execution providers
    ort.env.executionProviders = executionProviders;
    
    // Configure logging
    ort.env.logLevel = process.env.NODE_ENV === 'production' ? 'warning' : 'info';
    
    logger.info(`ONNX Runtime configured with providers: ${executionProviders.join(', ')}`);
  }

  /**
   * Load and cache an ONNX model session
   */
  async loadModel(modelName: string, theme: string, version: string = 'latest'): Promise<InferenceSession> {
    const sessionKey = `${theme}/${modelName}/${version}`;
    
    try {
      // Check if session already exists
      if (this.sessions.has(sessionKey)) {
        const session = this.sessions.get(sessionKey)!;
        session.lastUsed = new Date();
        logger.debug(`Using cached ONNX session: ${sessionKey}`);
        return session;
      }

      // Check session limit
      if (this.sessions.size >= this.maxSessions) {
        await this.evictOldestSession();
      }

      // Get model file path
      const modelPath = await modelStorageService.getModel(modelName, theme, version);
      
      // Create ONNX session
      const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: ort.env.executionProviders,
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential',
      };

      // Add GPU-specific options if available
      if (ort.env.executionProviders.includes('cuda')) {
        sessionOptions.providers = [{
          name: 'cuda',
          deviceId: 0,
          cudnnConvAlgoSearch: 'EXHAUSTIVE',
          cudnnConvUseMaxWorkspace: true,
        }];
      }

      const session = await ort.InferenceSession.create(modelPath, sessionOptions);
      
      // Get model metadata
      const models = await modelStorageService.listModels(theme);
      const metadata = models.find(m => m.modelName === modelName) || {
        modelName,
        version,
        theme,
        framework: 'onnx' as const,
        size: 0,
        checksum: '',
        lastModified: new Date(),
      };

      const inferenceSession: InferenceSession = {
        session,
        metadata,
        lastUsed: new Date(),
      };

      this.sessions.set(sessionKey, inferenceSession);
      
      logger.info(`ONNX model loaded: ${sessionKey}`);
      logger.info(`Input names: ${session.inputNames.join(', ')}`);
      logger.info(`Output names: ${session.outputNames.join(', ')}`);
      
      return inferenceSession;
      
    } catch (error) {
      logger.error(`Failed to load ONNX model ${sessionKey}:`, error);
      throw new Error(`Model loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run inference on a loaded model
   */
  async runInference(
    modelName: string,
    theme: string,
    inputs: Record<string, ModelInput>,
    version: string = 'latest'
  ): Promise<Record<string, ModelOutput>> {
    const sessionKey = `${theme}/${modelName}/${version}`;
    
    try {
      // Load model if not already loaded
      const inferenceSession = await this.loadModel(modelName, theme, version);
      
      // Prepare input tensors
      const feeds: Record<string, ort.Tensor> = {};
      
      for (const [inputName, input] of Object.entries(inputs)) {
        feeds[inputName] = new ort.Tensor(input.type, input.data, input.dims);
      }

      // Run inference
      const startTime = Date.now();
      const results = await inferenceSession.session.run(feeds);
      const inferenceTime = Date.now() - startTime;
      
      // Convert results to ModelOutput format
      const outputs: Record<string, ModelOutput> = {};
      
      for (const [outputName, tensor] of Object.entries(results)) {
        if (tensor && typeof tensor === 'object' && 'data' in tensor && 'dims' in tensor) {
          outputs[outputName] = {
            data: tensor.data as Float32Array,
            dims: tensor.dims as number[],
          };
        }
      }

      logger.debug(`Inference completed for ${sessionKey} in ${inferenceTime}ms`);
      
      // Update last used time
      inferenceSession.lastUsed = new Date();
      
      return outputs;
      
    } catch (error) {
      logger.error(`Inference failed for ${sessionKey}:`, error);
      throw new Error(`Inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get model input specifications
   */
  async getModelInputSpecs(modelName: string, theme: string, version: string = 'latest'): Promise<Record<string, any>> {
    try {
      const inferenceSession = await this.loadModel(modelName, theme, version);
      const inputSpecs: Record<string, any> = {};
      
      for (const inputName of inferenceSession.session.inputNames) {
        const inputMetadata = inferenceSession.session.inputMetadata[inputName];
        inputSpecs[inputName] = {
          dims: inputMetadata.dims,
          type: inputMetadata.type,
        };
      }
      
      return inputSpecs;
      
    } catch (error) {
      logger.error(`Failed to get input specs for ${theme}/${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Get model output specifications
   */
  async getModelOutputSpecs(modelName: string, theme: string, version: string = 'latest'): Promise<Record<string, any>> {
    try {
      const inferenceSession = await this.loadModel(modelName, theme, version);
      const outputSpecs: Record<string, any> = {};
      
      for (const outputName of inferenceSession.session.outputNames) {
        const outputMetadata = inferenceSession.session.outputMetadata[outputName];
        outputSpecs[outputName] = {
          dims: outputMetadata.dims,
          type: outputMetadata.type,
        };
      }
      
      return outputSpecs;
      
    } catch (error) {
      logger.error(`Failed to get output specs for ${theme}/${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Preload models for faster inference
   */
  async preloadModels(themes: string[]): Promise<void> {
    const preloadPromises = themes.map(async (theme) => {
      try {
        const models = await modelStorageService.listModels(theme);
        
        for (const model of models) {
          try {
            await this.loadModel(model.modelName, model.theme, model.version);
            logger.info(`Preloaded ONNX model: ${model.theme}/${model.modelName}`);
          } catch (error) {
            logger.warn(`Failed to preload ONNX model ${model.theme}/${model.modelName}:`, error);
          }
        }
      } catch (error) {
        logger.error(`Failed to preload models for theme ${theme}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
    logger.info('ONNX model preloading completed');
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    maxSessions: number;
    sessions: Array<{
      key: string;
      modelName: string;
      theme: string;
      lastUsed: Date;
    }>;
  } {
    const sessions = Array.from(this.sessions.entries()).map(([key, session]) => ({
      key,
      modelName: session.metadata.modelName,
      theme: session.metadata.theme,
      lastUsed: session.lastUsed,
    }));

    return {
      activeSessions: this.sessions.size,
      maxSessions: this.maxSessions,
      sessions,
    };
  }

  /**
   * Clear specific session or all sessions
   */
  async clearSessions(sessionKey?: string): Promise<void> {
    if (sessionKey) {
      const session = this.sessions.get(sessionKey);
      if (session) {
        await session.session.release();
        this.sessions.delete(sessionKey);
        logger.info(`Cleared ONNX session: ${sessionKey}`);
      }
    } else {
      for (const [key, session] of this.sessions.entries()) {
        await session.session.release();
        this.sessions.delete(key);
      }
      logger.info('Cleared all ONNX sessions');
    }
  }

  /**
   * Evict oldest session to make room for new one
   */
  private async evictOldestSession(): Promise<void> {
    if (this.sessions.size === 0) return;
    
    // Find oldest session
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, session] of this.sessions.entries()) {
      if (session.lastUsed.getTime() < oldestTime) {
        oldestTime = session.lastUsed.getTime();
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      await this.clearSessions(oldestKey);
      logger.info(`Evicted oldest ONNX session: ${oldestKey}`);
    }
  }

  /**
   * Start periodic session cleanup
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredSessions().catch((error) => {
        logger.error('Session cleanup failed:', error);
      });
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastUsed.getTime() > this.sessionTimeout) {
        expiredSessions.push(key);
      }
    }
    
    for (const key of expiredSessions) {
      await this.clearSessions(key);
      logger.info(`Cleaned up expired ONNX session: ${key}`);
    }
  }
}

// Singleton instance
export const onnxRuntimeService = new OnnxRuntimeService();