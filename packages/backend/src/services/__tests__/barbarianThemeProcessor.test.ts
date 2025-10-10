import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  FaceMeshData, 
  ProcessingOptions, 
  Vector3, 
  Triangle, 
  UVCoordinate, 
  NormalVector, 
  TextureCoordinate 
} from '../styleTransferEngine.js';

// Mock all external dependencies
vi.mock('../modelManager.js', () => ({
  ModelManager: vi.fn().mockImplementation(() => ({
    getModel: vi.fn().mockResolvedValue({
      session: { session: { run: vi.fn() } },
      config: { name: 'barbarian-style-transfer' }
    })
  })),
  ModelType: {
    STYLE_TRANSFER: 'style_transfer',
    TEXTURE_ADAPTATION: 'texture_adaptation', 
    LIGHTING_ADAPTATION: 'lighting_adaptation',
    FACE_MESH_GENERATOR: 'face_mesh_generator',
    QUALITY_VALIDATOR: 'quality_validator'
  }
}));

vi.mock('../onnxRuntimeService.js', () => ({
  onnxRuntimeService: {
    runInference: vi.fn().mockResolvedValue({
      styled_image: new Float32Array(512 * 512 * 3).fill(0.5)
    }),
    loadModel: vi.fn()
  }
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Import after mocking
const { BarbarianThemeProcessor } = await import('../barbarianThemeProcessor.js');
const { ModelManager } = await import('../modelManager.js');

describe('BarbarianThemeProcessor', () => {
  let processor: InstanceType<typeof BarbarianThemeProcessor>;
  let mockModelManager: any;

  const mockFaceMesh: FaceMeshData = {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 0.5, y: 0.5, z: 0.1 },
      { x: -0.5, y: 0.5, z: 0.1 },
      { x: 0, y: -0.5, z: 0.1 }
    ] as Vector3[],
    triangles: [
      { v1: 0, v2: 1, v3: 2 },
      { v1: 0, v2: 2, v3: 3 }
    ] as Triangle[],
    uvMapping: [
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 1, v: 1 },
      { u: 0, v: 1 }
    ] as UVCoordinate[],
    normalMap: [
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 1 }
    ] as NormalVector[],
    textureCoords: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ] as TextureCoordinate[]
  };

  const mockProcessingOptions: ProcessingOptions = {
    quality: 'balanced',
    styleIntensity: 0.8,
    preserveIdentity: 0.9,
    enableAdvancedFeatures: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock model manager instance
    mockModelManager = new ModelManager();
    processor = new BarbarianThemeProcessor(mockModelManager);
  });

  describe('applyBarbarianStyle', () => {
    it('should apply barbarian style transfer successfully', async () => {
      const result = await processor.applyBarbarianStyle(mockFaceMesh, mockProcessingOptions);
      
      expect(result).toBeDefined();
      expect(result.styledMesh).toBeDefined();
      expect(result.styleFeatures).toBeDefined();
      expect(result.transformationMatrix).toBeDefined();
      
      // Verify barbarian-specific features
      expect(result.styleFeatures.facialStructure.jawStrength).toBeGreaterThan(0.7);
      expect(result.styleFeatures.expressionIntensity).toBeGreaterThan(0.8);
    });

    it('should handle different quality settings', async () => {
      const fastOptions = { ...mockProcessingOptions, quality: 'fast' as const };
      const highOptions = { ...mockProcessingOptions, quality: 'high' as const };
      
      const fastResult = await processor.applyBarbarianStyle(mockFaceMesh, fastOptions);
      const highResult = await processor.applyBarbarianStyle(mockFaceMesh, highOptions);
      
      expect(fastResult).toBeDefined();
      expect(highResult).toBeDefined();
    });

    it('should adjust features based on style intensity', async () => {
      const lowIntensity = { ...mockProcessingOptions, styleIntensity: 0.3 };
      const highIntensity = { ...mockProcessingOptions, styleIntensity: 1.0 };
      
      const lowResult = await processor.applyBarbarianStyle(mockFaceMesh, lowIntensity);
      const highResult = await processor.applyBarbarianStyle(mockFaceMesh, highIntensity);
      
      expect(lowResult.styleFeatures.facialStructure.jawStrength)
        .toBeLessThan(highResult.styleFeatures.facialStructure.jawStrength);
    });

    it('should handle model loading errors gracefully', async () => {
      // Mock the model manager to throw an error
      vi.mocked(mockModelManager.getModel).mockRejectedValueOnce(new Error('Model loading failed'));
      
      await expect(processor.applyBarbarianStyle(mockFaceMesh, mockProcessingOptions))
        .rejects.toThrow('Barbarian style transfer failed');
    });
  });

  describe('adaptBarbarianTexture', () => {
    it('should adapt texture with barbarian characteristics', async () => {
      const mockStyledResult = {
        styledMesh: mockFaceMesh,
        styleFeatures: {
          skinTone: { r: 0.6, g: 0.4, b: 0.3 },
          hairColor: { r: 0.3, g: 0.2, b: 0.1 },
          eyeColor: { r: 0.4, g: 0.3, b: 0.2 },
          facialStructure: {
            jawStrength: 0.8,
            cheekboneProminence: 0.7,
            eyeSize: 1.0,
            noseShape: 1.1,
            lipFullness: 0.7
          },
          expressionIntensity: 0.9
        },
        transformationMatrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
      };
      
      const result = await processor.adaptBarbarianTexture(mockStyledResult, mockProcessingOptions);
      
      expect(result).toBeDefined();
      expect(result.texturedMesh).toBeDefined();
      expect(result.baseTexture).toBeDefined();
      expect(result.normalTexture).toBeDefined();
      expect(result.specularTexture).toBeDefined();
      
      // Verify texture properties
      expect(result.baseTexture.width).toBe(512);
      expect(result.baseTexture.height).toBe(512);
      expect(result.baseTexture.channels).toBe(4);
    });

    it('should generate rugged skin texture', async () => {
      const mockStyledResult = {
        styledMesh: mockFaceMesh,
        styleFeatures: {
          skinTone: { r: 0.6, g: 0.4, b: 0.3 },
          hairColor: { r: 0.3, g: 0.2, b: 0.1 },
          eyeColor: { r: 0.4, g: 0.3, b: 0.2 },
          facialStructure: {
            jawStrength: 0.8,
            cheekboneProminence: 0.7,
            eyeSize: 1.0,
            noseShape: 1.1,
            lipFullness: 0.7
          },
          expressionIntensity: 0.9
        },
        transformationMatrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
      };
      
      const result = await processor.adaptBarbarianTexture(mockStyledResult, mockProcessingOptions);
      
      // Check that texture data is generated
      expect(result.baseTexture.data).toBeInstanceOf(Uint8Array);
      expect(result.baseTexture.data.length).toBe(512 * 512 * 4);
      
      // Verify some pixels have been modified (not all zeros)
      const hasNonZeroPixels = Array.from(result.baseTexture.data).some(value => value > 0);
      expect(hasNonZeroPixels).toBe(true);
    });
  });

  describe('adaptBarbarianLighting', () => {
    it('should create dramatic barbarian lighting', async () => {
      const mockTexturedResult = {
        texturedMesh: mockFaceMesh,
        baseTexture: {
          data: new Uint8Array(512 * 512 * 4),
          width: 512,
          height: 512,
          channels: 4
        },
        normalTexture: {
          data: new Uint8Array(512 * 512 * 4),
          width: 512,
          height: 512,
          channels: 4
        },
        specularTexture: {
          data: new Uint8Array(512 * 512 * 4),
          width: 512,
          height: 512,
          channels: 4
        }
      };
      
      const originalImage = Buffer.from('mock image data');
      
      const result = await processor.adaptBarbarianLighting(mockTexturedResult, originalImage);
      
      expect(result).toBeDefined();
      expect(result.finalMesh).toBeDefined();
      expect(result.lightingData).toBeDefined();
      expect(result.atmosphericEffects).toBeDefined();
      
      // Verify dramatic lighting characteristics
      expect(result.lightingData.primaryLight.intensity).toBeGreaterThan(1.0);
      expect(result.lightingData.ambientLight.intensity).toBeLessThan(0.3);
      expect(result.lightingData.shadows.length).toBeGreaterThan(0);
      
      // Verify atmospheric effects
      expect(result.atmosphericEffects.particles.length).toBeGreaterThan(0);
      expect(result.atmosphericEffects.colorGrading.contrast).toBeGreaterThan(1.0);
    });

    it('should generate harsh shadows', async () => {
      const mockTexturedResult = {
        texturedMesh: mockFaceMesh,
        baseTexture: {
          data: new Uint8Array(512 * 512 * 4),
          width: 512,
          height: 512,
          channels: 4
        },
        normalTexture: {
          data: new Uint8Array(512 * 512 * 4),
          width: 512,
          height: 512,
          channels: 4
        },
        specularTexture: {
          data: new Uint8Array(512 * 512 * 4),
          width: 512,
          height: 512,
          channels: 4
        }
      };
      
      const originalImage = Buffer.from('mock image data');
      
      const result = await processor.adaptBarbarianLighting(mockTexturedResult, originalImage);
      
      // Verify shadows are harsh (low softness)
      result.lightingData.shadows.forEach(shadow => {
        expect(shadow.softness).toBeLessThan(0.3);
        expect(shadow.intensity).toBeGreaterThan(0.5);
      });
    });
  });

  describe('configuration handling', () => {
    it('should adjust configuration based on style intensity', async () => {
      const lowIntensityOptions = { ...mockProcessingOptions, styleIntensity: 0.3 };
      const highIntensityOptions = { ...mockProcessingOptions, styleIntensity: 1.0 };
      
      // Test with different intensities
      const lowResult = await processor.applyBarbarianStyle(mockFaceMesh, lowIntensityOptions);
      const highResult = await processor.applyBarbarianStyle(mockFaceMesh, highIntensityOptions);
      
      // Higher intensity should result in more dramatic features
      expect(highResult.styleFeatures.facialStructure.jawStrength)
        .toBeGreaterThan(lowResult.styleFeatures.facialStructure.jawStrength);
    });

    it('should adjust configuration based on quality setting', async () => {
      const fastOptions = { ...mockProcessingOptions, quality: 'fast' as const };
      const highOptions = { ...mockProcessingOptions, quality: 'high' as const };
      
      const fastResult = await processor.applyBarbarianStyle(mockFaceMesh, fastOptions);
      const highResult = await processor.applyBarbarianStyle(mockFaceMesh, highOptions);
      
      expect(fastResult).toBeDefined();
      expect(highResult).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle ONNX inference errors', async () => {
      const { onnxRuntimeService } = await import('../onnxRuntimeService.js');
      vi.mocked(onnxRuntimeService.runInference).mockRejectedValueOnce(new Error('Inference failed'));
      
      await expect(processor.applyBarbarianStyle(mockFaceMesh, mockProcessingOptions))
        .rejects.toThrow('Barbarian style transfer failed');
    });

    it('should handle texture generation errors gracefully', async () => {
      const mockStyledResult = {
        styledMesh: mockFaceMesh,
        styleFeatures: {
          skinTone: { r: 0.6, g: 0.4, b: 0.3 },
          hairColor: { r: 0.3, g: 0.2, b: 0.1 },
          eyeColor: { r: 0.4, g: 0.3, b: 0.2 },
          facialStructure: {
            jawStrength: 0.8,
            cheekboneProminence: 0.7,
            eyeSize: 1.0,
            noseShape: 1.1,
            lipFullness: 0.7
          },
          expressionIntensity: 0.9
        },
        transformationMatrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
      };
      
      // Should not throw even with edge case data
      const result = await processor.adaptBarbarianTexture(mockStyledResult, mockProcessingOptions);
      expect(result).toBeDefined();
    });
  });
});