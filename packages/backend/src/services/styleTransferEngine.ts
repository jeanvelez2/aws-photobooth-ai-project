import { logger } from '../utils/logger.js';
import { onnxRuntimeService } from './onnxRuntimeService.js';
import { modelStorageService } from './modelStorageService.js';
import { faceDetectionService, FaceDetectionResult } from './faceDetectionService.js';
import { GPUMemoryManager } from './gpuMemoryManager.js';
import { ModelManager } from './modelManager.js';
import { QualityValidator } from './qualityValidator.js';
import { FallbackProcessor } from './fallbackProcessor.js';
import { BarbarianThemeProcessor } from './barbarianThemeProcessor.js';
import { GreekThemeProcessor } from './greekThemeProcessor.js';
import { v4 as uuidv4 } from 'uuid';

export type ThemeType = 'barbarian' | 'greek' | 'mystic' | 'anime';

export interface ProcessingInput {
  originalImage: Buffer;
  theme: ThemeType;
  faceData: FaceDetectionResult;
  processingOptions: ProcessingOptions;
  requestId?: string;
}

export interface ProcessingOptions {
  quality: 'fast' | 'balanced' | 'high';
  styleIntensity: number; // 0.1 to 1.0
  preserveIdentity: number; // 0.7 to 1.0
  enableAdvancedFeatures: boolean;
  outputFormat?: 'jpeg' | 'png';
  targetWidth?: number;
  targetHeight?: number;
  gpuMemoryLimit?: number; // MB
  timeoutMs?: number;
}

export interface ProcessingResult {
  success: boolean;
  processedImage?: Buffer;
  processingTimeMs: number;
  qualityMetrics?: QualityMetrics;
  error?: ProcessingError;
  fallbackUsed?: boolean;
  gpuMemoryUsed?: number;
}

export interface QualityMetrics {
  overall: number; // 0.0 to 1.0
  facialProportions: number;
  skinTexture: number;
  lightingConsistency: number;
  edgeBlending: number;
  colorHarmony: number;
  identityPreservation: number;
}

export interface ProcessingError {
  type: StyleTransferErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  fallbackAvailable: boolean;
  suggestedActions: string[];
  technicalDetails?: Record<string, any>;
}

export enum StyleTransferErrorType {
  MODEL_LOADING_FAILED = 'MODEL_LOADING_FAILED',
  INSUFFICIENT_GPU_MEMORY = 'INSUFFICIENT_GPU_MEMORY',
  FACE_MESH_GENERATION_FAILED = 'FACE_MESH_GENERATION_FAILED',
  STYLE_TRANSFER_TIMEOUT = 'STYLE_TRANSFER_TIMEOUT',
  QUALITY_VALIDATION_FAILED = 'QUALITY_VALIDATION_FAILED',
  TEXTURE_ADAPTATION_FAILED = 'TEXTURE_ADAPTATION_FAILED',
  LIGHTING_ANALYSIS_FAILED = 'LIGHTING_ANALYSIS_FAILED',
  IDENTITY_PRESERVATION_FAILED = 'IDENTITY_PRESERVATION_FAILED',
  UNCANNY_VALLEY_DETECTED = 'UNCANNY_VALLEY_DETECTED',
  INVALID_INPUT = 'INVALID_INPUT',
  PROCESSING_FAILED = 'PROCESSING_FAILED'
}

export interface StyleTransferPipeline {
  preprocess(input: ProcessingInput): Promise<PreprocessedData>;
  generateFaceMesh(faceData: FaceDetectionResult): Promise<FaceMeshData>;
  applyStyleTransfer(mesh: FaceMeshData, theme: ThemeType, options: ProcessingOptions): Promise<StyledResult>;
  adaptTexture(result: StyledResult, theme: ThemeType, options: ProcessingOptions): Promise<TexturedResult>;
  adaptLighting(result: TexturedResult, originalImage: Buffer): Promise<LitResult>;
  postprocess(result: LitResult, options: ProcessingOptions): Promise<Buffer>;
  validateQuality(result: Buffer, original: Buffer): Promise<QualityMetrics>;
}

export interface PreprocessedData {
  normalizedImage: Buffer;
  faceRegion: FaceRegion;
  backgroundRegion: Buffer;
  metadata: ImageMetadata;
}

export interface FaceRegion {
  bounds: BoundingBox;
  landmarks: FacialLandmark[];
  pose: FacePose;
  quality: FaceQuality;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FacialLandmark {
  x: number;
  y: number;
  confidence: number;
  type: string;
}

export interface FacePose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface FaceQuality {
  sharpness: number;
  brightness: number;
  contrast: number;
  symmetry: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  channels: number;
  colorSpace: string;
  hasAlpha: boolean;
}

export interface FaceMeshData {
  vertices: Vector3[];
  triangles: Triangle[];
  uvMapping: UVCoordinate[];
  normalMap: NormalVector[];
  textureCoords: TextureCoordinate[];
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Triangle {
  v1: number;
  v2: number;
  v3: number;
}

export interface UVCoordinate {
  u: number;
  v: number;
}

export interface NormalVector {
  x: number;
  y: number;
  z: number;
}

export interface TextureCoordinate {
  x: number;
  y: number;
}

export interface StyledResult {
  styledMesh: FaceMeshData;
  styleFeatures: StyleFeatures;
  transformationMatrix: number[][];
}

export interface StyleFeatures {
  skinTone: RGB;
  hairColor: RGB;
  eyeColor: RGB;
  facialStructure: FacialStructureAdjustments;
  expressionIntensity: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface FacialStructureAdjustments {
  jawStrength: number;
  cheekboneProminence: number;
  eyeSize: number;
  noseShape: number;
  lipFullness: number;
}

export interface TexturedResult {
  texturedMesh: FaceMeshData;
  baseTexture: TextureData;
  normalTexture: TextureData;
  specularTexture: TextureData;
}

export interface TextureData {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
}

export interface LitResult {
  finalMesh: FaceMeshData;
  lightingData: LightingData;
  atmosphericEffects: AtmosphericData;
}

export interface LightingData {
  primaryLight: LightSource;
  ambientLight: AmbientLighting;
  shadows: ShadowData[];
}

export interface LightSource {
  direction: Vector3;
  color: RGB;
  intensity: number;
  type: 'directional' | 'point' | 'spot';
}

export interface AmbientLighting {
  color: RGB;
  intensity: number;
}

export interface ShadowData {
  position: Vector3;
  intensity: number;
  softness: number;
}

export interface AtmosphericData {
  particles: ParticleEffect[];
  mist: MistEffect;
  colorGrading: ColorGrading;
}

export interface ParticleEffect {
  type: 'dust' | 'sparkles' | 'smoke' | 'magic';
  density: number;
  color: RGB;
  motion: Vector3;
}

export interface MistEffect {
  density: number;
  color: RGB;
  height: number;
}

export interface ColorGrading {
  shadows: RGB;
  midtones: RGB;
  highlights: RGB;
  saturation: number;
  contrast: number;
}

/**
 * Core Style Transfer Engine
 * Orchestrates the complete style transfer pipeline from input to final result
 */
export class StyleTransferEngine implements StyleTransferPipeline {
  private gpuMemoryManager: GPUMemoryManager;
  private modelManager: ModelManager;
  private qualityValidator: QualityValidator;
  private fallbackProcessor: FallbackProcessor;
  private barbarianProcessor: BarbarianThemeProcessor;
  private greekProcessor: GreekThemeProcessor;
  private currentTheme: ThemeType | null = null;

  constructor() {
    this.gpuMemoryManager = new GPUMemoryManager();
    this.modelManager = new ModelManager();
    this.qualityValidator = new QualityValidator();
    this.fallbackProcessor = new FallbackProcessor();
    this.barbarianProcessor = new BarbarianThemeProcessor(this.modelManager);
    this.greekProcessor = new GreekThemeProcessor(this.modelManager);
  }

  /**
   * Main processing entry point
   */
  async processImage(input: ProcessingInput): Promise<ProcessingResult> {
    const startTime = Date.now();
    const requestId = input.requestId || uuidv4();
    
    logger.info('Starting style transfer processing', {
      requestId,
      theme: input.theme,
      quality: input.processingOptions.quality,
      styleIntensity: input.processingOptions.styleIntensity
    });

    try {
      // Validate input
      this.validateInput(input);
      
      // Set current theme for processing
      this.currentTheme = input.theme;

      // Check GPU memory availability
      await this.gpuMemoryManager.checkAvailableMemory(input.processingOptions.gpuMemoryLimit);

      // Reserve GPU resources
      const memoryReservation = await this.gpuMemoryManager.reserveMemory(
        this.estimateMemoryRequirement(input)
      );

      try {
        // Execute processing pipeline
        const processedImage = await this.executePipeline(input, requestId);
        
        const processingTimeMs = Date.now() - startTime;
        const qualityMetrics = await this.validateQuality(processedImage, input.originalImage);
        
        logger.info('Style transfer completed successfully', {
          requestId,
          processingTimeMs,
          qualityScore: qualityMetrics.overall
        });

        return {
          success: true,
          processedImage,
          processingTimeMs,
          qualityMetrics,
          gpuMemoryUsed: memoryReservation.allocated
        };

      } finally {
        // Always release GPU memory
        await this.gpuMemoryManager.releaseMemory(memoryReservation.id);
      }

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      
      logger.error('Style transfer failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs
      });

      // Try fallback processing if available
      if (this.shouldUseFallback(error, input.processingOptions)) {
        try {
          const fallbackResult = await this.fallbackProcessor.process(input);
          
          return {
            success: true,
            processedImage: fallbackResult,
            processingTimeMs: Date.now() - startTime,
            fallbackUsed: true,
            error: this.createProcessingError(error, true)
          };
        } catch (fallbackError) {
          logger.error('Fallback processing also failed', {
            requestId,
            fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          });
        }
      }

      return {
        success: false,
        processingTimeMs,
        error: this.createProcessingError(error, false)
      };
    }
  }

  /**
   * Execute the complete processing pipeline
   */
  private async executePipeline(input: ProcessingInput, requestId: string): Promise<Buffer> {
    // Step 1: Preprocess input
    const preprocessed = await this.preprocess(input);
    
    // Step 2: Generate face mesh
    const faceMesh = await this.generateFaceMesh(input.faceData);
    
    // Step 3: Apply style transfer
    const styled = await this.applyStyleTransfer(faceMesh, input.theme, input.processingOptions);
    
    // Step 4: Adapt texture
    const textured = await this.adaptTexture(styled, input.theme, input.processingOptions);
    
    // Step 5: Adapt lighting
    const lit = await this.adaptLighting(textured, input.originalImage);
    
    // Step 6: Postprocess
    const final = await this.postprocess(lit, input.processingOptions);
    
    return final;
  }

  /**
   * Preprocess input image and extract face data
   */
  async preprocess(input: ProcessingInput): Promise<PreprocessedData> {
    // Implementation will be added in subsequent tasks
    throw new Error('Preprocess not implemented - will be implemented in face mesh generation task');
  }

  /**
   * Generate 3D face mesh from facial landmarks
   */
  async generateFaceMesh(faceData: FaceDetectionResult): Promise<FaceMeshData> {
    // Implementation will be added in subsequent tasks
    throw new Error('Face mesh generation not implemented - will be implemented in face mesh generation task');
  }

  /**
   * Apply neural network style transfer
   */
  async applyStyleTransfer(mesh: FaceMeshData, theme: ThemeType, options: ProcessingOptions): Promise<StyledResult> {
    logger.info('Applying style transfer', { theme, quality: options.quality });

    switch (theme) {
      case 'barbarian':
        return await this.barbarianProcessor.applyBarbarianStyle(mesh, options);
      
      case 'greek':
        return await this.greekProcessor.applyGreekStyle(mesh, options);
      
      case 'mystic':
        // Implementation will be added in Mystic theme task
        throw new Error('Mystic style transfer not implemented yet');
      
      case 'anime':
        // Implementation will be added in Anime theme task
        throw new Error('Anime style transfer not implemented yet');
      
      default:
        throw new Error(`Unsupported theme: ${theme}`);
    }
  }

  /**
   * Adapt texture based on theme
   */
  async adaptTexture(result: StyledResult, theme: ThemeType, options: ProcessingOptions): Promise<TexturedResult> {
    logger.info('Adapting texture', { theme });

    switch (theme) {
      case 'barbarian':
        return await this.barbarianProcessor.adaptBarbarianTexture(result, options);
      
      case 'greek':
        return await this.greekProcessor.adaptGreekTexture(result, options);
      
      case 'mystic':
        // Implementation will be added in Mystic theme task
        throw new Error('Mystic texture adaptation not implemented yet');
      
      case 'anime':
        // Implementation will be added in Anime theme task
        throw new Error('Anime texture adaptation not implemented yet');
      
      default:
        throw new Error(`Unsupported theme: ${theme}`);
    }
  }

  /**
   * Adapt lighting to match background
   */
  async adaptLighting(result: TexturedResult, originalImage: Buffer): Promise<LitResult> {
    logger.info('Adapting lighting');

    // Route to appropriate theme processor for lighting adaptation
    switch (this.getCurrentTheme()) {
      case 'barbarian':
        return await this.barbarianProcessor.adaptBarbarianLighting(result, originalImage);
      
      case 'greek':
        return await this.greekProcessor.adaptGreekLighting(result, originalImage);
      
      default:
        // Fallback to barbarian lighting for unimplemented themes
        return await this.barbarianProcessor.adaptBarbarianLighting(result, originalImage);
    }
  }

  /**
   * Final postprocessing and optimization
   */
  async postprocess(result: LitResult, options: ProcessingOptions): Promise<Buffer> {
    // Implementation will be added in subsequent tasks
    throw new Error('Postprocessing not implemented - will be implemented in subsequent tasks');
  }

  /**
   * Validate quality of processed result
   */
  async validateQuality(result: Buffer, original: Buffer): Promise<QualityMetrics> {
    return this.qualityValidator.validate(result, original);
  }

  /**
   * Get current theme being processed
   */
  private getCurrentTheme(): ThemeType {
    return this.currentTheme || 'barbarian';
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: ProcessingInput): void {
    if (!input.originalImage || input.originalImage.length === 0) {
      throw new Error('Invalid input: originalImage is required');
    }

    if (!input.theme || !['barbarian', 'greek', 'mystic', 'anime'].includes(input.theme)) {
      throw new Error('Invalid input: theme must be one of barbarian, greek, mystic, anime');
    }

    if (!input.faceData || !input.faceData.faces || input.faceData.faces.length === 0) {
      throw new Error('Invalid input: faceData with at least one face is required');
    }

    if (!input.processingOptions) {
      throw new Error('Invalid input: processingOptions is required');
    }

    const options = input.processingOptions;
    
    if (options.styleIntensity < 0.1 || options.styleIntensity > 1.0) {
      throw new Error('Invalid input: styleIntensity must be between 0.1 and 1.0');
    }

    if (options.preserveIdentity < 0.7 || options.preserveIdentity > 1.0) {
      throw new Error('Invalid input: preserveIdentity must be between 0.7 and 1.0');
    }
  }

  /**
   * Estimate memory requirement for processing
   */
  private estimateMemoryRequirement(input: ProcessingInput): number {
    const baseMemory = 512; // MB base requirement
    const qualityMultiplier = {
      fast: 1.0,
      balanced: 1.5,
      high: 2.0
    };
    
    const themeMultiplier = {
      barbarian: 1.2,
      greek: 1.0,
      mystic: 1.3,
      anime: 1.1
    };

    return Math.round(
      baseMemory * 
      qualityMultiplier[input.processingOptions.quality] * 
      themeMultiplier[input.theme]
    );
  }

  /**
   * Determine if fallback processing should be used
   */
  private shouldUseFallback(error: any, options: ProcessingOptions): boolean {
    if (!options.enableAdvancedFeatures) {
      return false;
    }

    const fallbackErrors = [
      'INSUFFICIENT_GPU_MEMORY',
      'STYLE_TRANSFER_TIMEOUT',
      'MODEL_LOADING_FAILED'
    ];

    const errorType = error?.type || error?.message || '';
    return fallbackErrors.some(type => errorType.includes(type));
  }

  /**
   * Create standardized processing error
   */
  private createProcessingError(error: any, fallbackAvailable: boolean): ProcessingError {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Map common errors to user-friendly messages
    const errorMappings: Record<string, Partial<ProcessingError>> = {
      'INSUFFICIENT_GPU_MEMORY': {
        type: StyleTransferErrorType.INSUFFICIENT_GPU_MEMORY,
        userMessage: 'Processing requires more GPU memory than available. Try using fast quality mode.',
        retryable: true,
        suggestedActions: ['Use fast quality mode', 'Try again later when resources are available']
      },
      'MODEL_LOADING_FAILED': {
        type: StyleTransferErrorType.MODEL_LOADING_FAILED,
        userMessage: 'Failed to load AI model. Please try again.',
        retryable: true,
        suggestedActions: ['Try again', 'Contact support if problem persists']
      },
      'STYLE_TRANSFER_TIMEOUT': {
        type: StyleTransferErrorType.STYLE_TRANSFER_TIMEOUT,
        userMessage: 'Processing took too long. Try using fast quality mode.',
        retryable: true,
        suggestedActions: ['Use fast quality mode', 'Try with a smaller image']
      }
    };

    const mapping = Object.entries(errorMappings).find(([key]) => 
      errorMessage.includes(key)
    )?.[1];

    return {
      type: mapping?.type || StyleTransferErrorType.PROCESSING_FAILED,
      message: errorMessage,
      userMessage: mapping?.userMessage || 'An error occurred during processing. Please try again.',
      retryable: mapping?.retryable || false,
      fallbackAvailable,
      suggestedActions: mapping?.suggestedActions || ['Try again'],
      technicalDetails: {
        originalError: errorMessage,
        timestamp: new Date().toISOString()
      }
    };
  }
}