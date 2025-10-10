import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StyleTransferEngine, ProcessingInput, ProcessingOptions, ThemeType } from '../styleTransferEngine.js';
import { FaceDetectionResult } from '../faceDetectionService.js';

// Mock dependencies
vi.mock('../gpuMemoryManager.js', () => ({
  GPUMemoryManager: vi.fn().mockImplementation(() => ({
    checkAvailableMemory: vi.fn().mockResolvedValue({ available: 1000 }),
    reserveMemory: vi.fn().mockResolvedValue({ id: 'test-reservation', allocated: 0 }),
    releaseMemory: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../modelManager.js', () => ({
  ModelManager: vi.fn().mockImplementation(() => ({
    loadThemeModels: vi.fn().mockResolvedValue({ success: true, loadedModels: [] }),
    getModel: vi.fn().mockResolvedValue({ config: {}, session: {} })
  }))
}));

vi.mock('../qualityValidator.js', () => ({
  QualityValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue({
      overall: 0.8,
      facialProportions: 0.8,
      skinTexture: 0.7,
      lightingConsistency: 0.8,
      edgeBlending: 0.8,
      colorHarmony: 0.7,
      identityPreservation: 0.9
    })
  }))
}));

vi.mock('../fallbackProcessor.js', () => ({
  FallbackProcessor: vi.fn().mockImplementation(() => ({
    process: vi.fn().mockResolvedValue(Buffer.from('fallback-result'))
  }))
}));

vi.mock('../onnxRuntimeService.js', () => ({
  onnxRuntimeService: {
    loadModel: vi.fn().mockResolvedValue({ session: {}, metadata: {} }),
    runInference: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../modelStorageService.js', () => ({
  modelStorageService: {
    getModel: vi.fn().mockResolvedValue('/path/to/model'),
    listModels: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../faceDetectionService.js', () => ({
  faceDetectionService: {
    detectFaces: vi.fn().mockResolvedValue({
      faces: [{ boundingBox: { left: 0.2, top: 0.2, width: 0.4, height: 0.4 } }]
    })
  }
}));

describe('StyleTransferEngine', () => {
  let engine: StyleTransferEngine;
  let mockInput: ProcessingInput;

  beforeEach(() => {
    engine = new StyleTransferEngine();
    
    // Create mock input
    mockInput = {
      originalImage: Buffer.from('mock-image-data'),
      theme: 'barbarian' as ThemeType,
      faceData: {
        faces: [{
          boundingBox: { left: 0.2, top: 0.2, width: 0.4, height: 0.4 },
          landmarks: [],
          confidence: 0.95,
          gender: { value: 'Male', confidence: 0.8 },
          age: { value: 30, confidence: 0.7 },
          emotions: []
        }],
        imageWidth: 1024,
        imageHeight: 1024,
        processingTimeMs: 100
      } as FaceDetectionResult,
      processingOptions: {
        quality: 'balanced',
        styleIntensity: 0.8,
        preserveIdentity: 0.9,
        enableAdvancedFeatures: true,
        outputFormat: 'jpeg'
      } as ProcessingOptions,
      requestId: 'test-request-123'
    };
  });

  describe('Input Validation', () => {
    it('should validate required input fields', async () => {
      // Test missing originalImage
      const invalidInput = { ...mockInput, originalImage: Buffer.alloc(0) };
      
      const result = await engine.processImage(invalidInput);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('originalImage is required');
    });

    it('should validate theme parameter', async () => {
      const invalidInput = { ...mockInput, theme: 'invalid-theme' as ThemeType };
      
      const result = await engine.processImage(invalidInput);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('theme must be one of barbarian, greek, mystic, anime');
    });

    it('should validate face data', async () => {
      const invalidInput = { 
        ...mockInput, 
        faceData: { ...mockInput.faceData, faces: [] }
      };
      
      const result = await engine.processImage(invalidInput);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('faceData with at least one face is required');
    });

    it('should validate style intensity range', async () => {
      const invalidInput = { 
        ...mockInput, 
        processingOptions: { ...mockInput.processingOptions, styleIntensity: 1.5 }
      };
      
      const result = await engine.processImage(invalidInput);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('styleIntensity must be between 0.1 and 1.0');
    });

    it('should validate preserve identity range', async () => {
      const invalidInput = { 
        ...mockInput, 
        processingOptions: { ...mockInput.processingOptions, preserveIdentity: 0.5 }
      };
      
      const result = await engine.processImage(invalidInput);
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('preserveIdentity must be between 0.7 and 1.0');
    });
  });

  describe('Memory Estimation', () => {
    it('should estimate memory requirements correctly', () => {
      // Access private method for testing
      const estimateMemory = (engine as any).estimateMemoryRequirement.bind(engine);
      
      const fastMemory = estimateMemory({ ...mockInput, processingOptions: { ...mockInput.processingOptions, quality: 'fast' } });
      const balancedMemory = estimateMemory({ ...mockInput, processingOptions: { ...mockInput.processingOptions, quality: 'balanced' } });
      const highMemory = estimateMemory({ ...mockInput, processingOptions: { ...mockInput.processingOptions, quality: 'high' } });
      
      expect(fastMemory).toBeLessThan(balancedMemory);
      expect(balancedMemory).toBeLessThan(highMemory);
    });

    it('should apply theme-specific memory multipliers', () => {
      const estimateMemory = (engine as any).estimateMemoryRequirement.bind(engine);
      
      const barbarianMemory = estimateMemory({ ...mockInput, theme: 'barbarian' });
      const greekMemory = estimateMemory({ ...mockInput, theme: 'greek' });
      const mysticMemory = estimateMemory({ ...mockInput, theme: 'mystic' });
      
      expect(mysticMemory).toBeGreaterThan(barbarianMemory);
      expect(barbarianMemory).toBeGreaterThan(greekMemory);
    });
  });

  describe('Error Handling', () => {
    it('should create appropriate processing errors', () => {
      const createError = (engine as any).createProcessingError.bind(engine);
      
      const error = new Error('INSUFFICIENT_GPU_MEMORY: Not enough memory');
      const processingError = createError(error, true);
      
      expect(processingError.type).toBe('INSUFFICIENT_GPU_MEMORY');
      expect(processingError.retryable).toBe(true);
      expect(processingError.fallbackAvailable).toBe(true);
      expect(processingError.userMessage).toContain('GPU memory');
    });

    it('should determine fallback eligibility correctly', () => {
      const shouldUseFallback = (engine as any).shouldUseFallback.bind(engine);
      
      const memoryError = { message: 'INSUFFICIENT_GPU_MEMORY' };
      const timeoutError = { message: 'STYLE_TRANSFER_TIMEOUT' };
      const unknownError = { message: 'Unknown error' };
      
      expect(shouldUseFallback(memoryError, mockInput.processingOptions)).toBe(true);
      expect(shouldUseFallback(timeoutError, mockInput.processingOptions)).toBe(true);
      expect(shouldUseFallback(unknownError, mockInput.processingOptions)).toBe(false);
      
      // Should not use fallback if advanced features disabled
      const basicOptions = { ...mockInput.processingOptions, enableAdvancedFeatures: false };
      expect(shouldUseFallback(memoryError, basicOptions)).toBe(false);
    });
  });

  describe('Processing Pipeline', () => {
    it('should handle processing pipeline errors gracefully', async () => {
      // The actual processing will fail since we haven't implemented the pipeline methods yet
      // This tests that the error handling works correctly
      
      const result = await engine.processImage(mockInput);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});