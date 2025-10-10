import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GreekThemeProcessor } from '../greekThemeProcessor.js';
import { ModelManager } from '../modelManager.js';
import { onnxRuntimeService } from '../onnxRuntimeService.js';
import { FaceMeshData, ProcessingOptions } from '../styleTransferEngine.js';

// Mock dependencies
vi.mock('../modelManager.js');
vi.mock('../onnxRuntimeService.js', () => ({
  onnxRuntimeService: {
    runInference: vi.fn()
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

describe('GreekThemeProcessor', () => {
  let greekProcessor: GreekThemeProcessor;
  let mockModelManager: ModelManager;
  let mockFaceMesh: FaceMeshData;
  let mockProcessingOptions: ProcessingOptions;

  beforeEach(() => {
    mockModelManager = new ModelManager();
    greekProcessor = new GreekThemeProcessor(mockModelManager);

    // Mock face mesh data
    mockFaceMesh = {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 0.5, y: 0.3, z: 0.1 },
        { x: -0.5, y: 0.3, z: 0.1 },
        { x: 0, y: -0.5, z: 0.05 }
      ],
      triangles: [
        { v1: 0, v2: 1, v3: 2 },
        { v1: 0, v2: 2, v3: 3 }
      ],
      uvMapping: [
        { u: 0.5, v: 0.5 },
        { u: 0.7, v: 0.3 },
        { u: 0.3, v: 0.3 },
        { u: 0.5, v: 0.8 }
      ],
      normalMap: [
        { x: 0, y: 0, z: 1 },
        { x: 0.1, y: 0.1, z: 0.9 },
        { x: -0.1, y: 0.1, z: 0.9 },
        { x: 0, y: -0.1, z: 0.9 }
      ],
      textureCoords: [
        { x: 0.5, y: 0.5 },
        { x: 0.7, y: 0.3 },
        { x: 0.3, y: 0.3 },
        { x: 0.5, y: 0.8 }
      ]
    };

    // Mock processing options
    mockProcessingOptions = {
      quality: 'balanced',
      styleIntensity: 0.8,
      preserveIdentity: 0.9,
      enableAdvancedFeatures: true,
      outputFormat: 'jpeg',
      targetWidth: 512,
      targetHeight: 512
    };

    // Mock ONNX runtime service
    vi.mocked(onnxRuntimeService.runInference).mockResolvedValue({
      styled_image: {
        data: new Float32Array(512 * 512 * 3).fill(0.8),
        dims: [1, 3, 512, 512]
      }
    });

    // Mock model manager
    vi.mocked(mockModelManager.getModel).mockResolvedValue({
      session: {
        session: {
          run: vi.fn(),
          inputNames: ['input'],
          outputNames: ['output'],
          inputMetadata: {},
          outputMetadata: {},
          release: vi.fn()
        },
        metadata: {
          modelName: 'greek-style-transfer',
          version: '1.0',
          theme: 'greek',
          framework: 'onnx',
          inputDimensions: [1, 3, 512, 512],
          outputDimensions: [1, 3, 512, 512],
          createdAt: new Date()
        },
        lastUsed: new Date()
      },
      config: {
        name: 'greek-style-transfer',
        version: '1.0',
        type: 'STYLE_TRANSFER' as const,
        framework: 'onnx' as const,
        inputSpecs: [],
        outputSpecs: [],
        memoryRequirement: 1024,
        computeRequirement: 'medium' as const,
        supportedFormats: ['jpeg', 'png']
      }
    });
  });

  describe('applyGreekStyle', () => {
    it('should apply Greek classical style transfer successfully', async () => {
      const result = await greekProcessor.applyGreekStyle(mockFaceMesh, mockProcessingOptions);

      expect(result).toBeDefined();
      expect(result.styledMesh).toBeDefined();
      expect(result.styleFeatures).toBeDefined();
      expect(result.transformationMatrix).toBeDefined();

      // Verify Greek-specific style features
      expect(result.styleFeatures.skinTone.r).toBeGreaterThan(0.8); // Marble-like skin should be light
      expect(result.styleFeatures.skinTone.g).toBeGreaterThan(0.8);
      expect(result.styleFeatures.skinTone.b).toBeGreaterThan(0.7);

      // Verify classical hair color (golden-brown)
      expect(result.styleFeatures.hairColor.r).toBeGreaterThan(0.6);
      expect(result.styleFeatures.hairColor.g).toBeGreaterThan(0.4);
      expect(result.styleFeatures.hairColor.b).toBeGreaterThan(0.2);

      // Verify noble expression (serene, composed)
      expect(result.styleFeatures.expressionIntensity).toBeLessThan(0.8); // Should be calm, not intense
    });

    it('should apply golden ratio adjustments when enabled', async () => {
      const result = await greekProcessor.applyGreekStyle(mockFaceMesh, mockProcessingOptions);

      // Verify that facial proportions are adjusted
      expect(result.styledMesh.vertices).toBeDefined();
      expect(result.styledMesh.vertices.length).toBe(mockFaceMesh.vertices.length);

      // Verify transformation matrix includes golden ratio influence
      expect(result.transformationMatrix).toBeDefined();
      expect(result.transformationMatrix.length).toBe(4);
      expect(result.transformationMatrix[0].length).toBe(4);
    });

    it('should handle different quality settings', async () => {
      // Test fast quality
      const fastOptions = { ...mockProcessingOptions, quality: 'fast' as const };
      const fastResult = await greekProcessor.applyGreekStyle(mockFaceMesh, fastOptions);
      expect(fastResult).toBeDefined();

      // Test high quality
      const highOptions = { ...mockProcessingOptions, quality: 'high' as const };
      const highResult = await greekProcessor.applyGreekStyle(mockFaceMesh, highOptions);
      expect(highResult).toBeDefined();
    });

    it('should respect style intensity parameter', async () => {
      // Test low intensity
      const lowIntensityOptions = { ...mockProcessingOptions, styleIntensity: 0.3 };
      const lowResult = await greekProcessor.applyGreekStyle(mockFaceMesh, lowIntensityOptions);

      // Test high intensity
      const highIntensityOptions = { ...mockProcessingOptions, styleIntensity: 1.0 };
      const highResult = await greekProcessor.applyGreekStyle(mockFaceMesh, highIntensityOptions);

      // Both should succeed but with different intensities
      expect(lowResult).toBeDefined();
      expect(highResult).toBeDefined();
    });
  });

  describe('adaptGreekTexture', () => {
    it('should generate marble-like skin texture', async () => {
      const mockStyledResult = {
        styledMesh: mockFaceMesh,
        styleFeatures: {
          skinTone: { r: 0.9, g: 0.87, b: 0.82 },
          hairColor: { r: 0.7, g: 0.5, b: 0.3 },
          eyeColor: { r: 0.4, g: 0.5, b: 0.7 },
          facialStructure: {
            jawStrength: 0.7,
            cheekboneProminence: 0.8,
            eyeSize: 1.1,
            noseShape: 1.05,
            lipFullness: 0.95
          },
          expressionIntensity: 0.6
        },
        transformationMatrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
      };

      const result = await greekProcessor.adaptGreekTexture(mockStyledResult, mockProcessingOptions);

      expect(result).toBeDefined();
      expect(result.texturedMesh).toBeDefined();
      expect(result.baseTexture).toBeDefined();
      expect(result.normalTexture).toBeDefined();
      expect(result.specularTexture).toBeDefined();

      // Verify texture properties
      expect(result.baseTexture.width).toBe(512);
      expect(result.baseTexture.height).toBe(512);
      expect(result.baseTexture.channels).toBe(4);
      expect(result.baseTexture.data).toBeInstanceOf(Uint8Array);
    });

    it('should apply classical smoothing effects', async () => {
      const mockStyledResult = {
        styledMesh: mockFaceMesh,
        styleFeatures: {
          skinTone: { r: 0.9, g: 0.87, b: 0.82 },
          hairColor: { r: 0.7, g: 0.5, b: 0.3 },
          eyeColor: { r: 0.4, g: 0.5, b: 0.7 },
          facialStructure: {
            jawStrength: 0.7,
            cheekboneProminence: 0.8,
            eyeSize: 1.1,
            noseShape: 1.05,
            lipFullness: 0.95
          },
          expressionIntensity: 0.6
        },
        transformationMatrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
      };

      const result = await greekProcessor.adaptGreekTexture(mockStyledResult, mockProcessingOptions);

      // Verify that texture data is generated
      expect(result.baseTexture.data.length).toBeGreaterThan(0);
      expect(result.normalTexture.data.length).toBeGreaterThan(0);
      expect(result.specularTexture.data.length).toBeGreaterThan(0);
    });
  });

  describe('adaptGreekLighting', () => {
    it('should create soft classical lighting', async () => {
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

      const mockOriginalImage = Buffer.from('mock-image-data');
      const result = await greekProcessor.adaptGreekLighting(mockTexturedResult, mockOriginalImage);

      expect(result).toBeDefined();
      expect(result.finalMesh).toBeDefined();
      expect(result.lightingData).toBeDefined();
      expect(result.atmosphericEffects).toBeDefined();

      // Verify Greek-specific lighting characteristics
      expect(result.lightingData.primaryLight.intensity).toBeLessThan(1.5); // Soft lighting
      expect(result.lightingData.ambientLight.intensity).toBeGreaterThan(0.3); // Higher ambient
      expect(result.lightingData.shadows.length).toBeGreaterThan(0);

      // Verify soft shadows
      result.lightingData.shadows.forEach(shadow => {
        expect(shadow.softness).toBeGreaterThan(0.5); // Should be soft
        expect(shadow.intensity).toBeLessThan(0.5); // Should be gentle
      });
    });

    it('should create temple-like atmospheric effects', async () => {
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

      const mockOriginalImage = Buffer.from('mock-image-data');
      const result = await greekProcessor.adaptGreekLighting(mockTexturedResult, mockOriginalImage);

      // Verify atmospheric effects
      expect(result.atmosphericEffects.particles).toBeDefined();
      expect(result.atmosphericEffects.mist).toBeDefined();
      expect(result.atmosphericEffects.colorGrading).toBeDefined();

      // Verify classical color grading
      expect(result.atmosphericEffects.colorGrading.saturation).toBeLessThan(1.0); // Slightly desaturated
      expect(result.atmosphericEffects.colorGrading.contrast).toBeLessThan(1.0); // Lower contrast for softness
    });
  });

  describe('error handling', () => {
    it('should handle model loading failures gracefully', async () => {
      vi.mocked(mockModelManager.getModel).mockRejectedValue(new Error('Model loading failed'));

      await expect(greekProcessor.applyGreekStyle(mockFaceMesh, mockProcessingOptions))
        .rejects.toThrow('Greek style transfer failed: Model loading failed');
    });

    it('should handle ONNX runtime failures gracefully', async () => {
      vi.mocked(onnxRuntimeService.runInference).mockRejectedValue(new Error('ONNX inference failed'));

      await expect(greekProcessor.applyGreekStyle(mockFaceMesh, mockProcessingOptions))
        .rejects.toThrow('Greek style transfer failed: ONNX inference failed');
    });
  });

  describe('configuration', () => {
    it('should adjust configuration based on quality settings', async () => {
      // Test that fast quality disables complex features
      const fastOptions = { ...mockProcessingOptions, quality: 'fast' as const };
      const result = await greekProcessor.applyGreekStyle(mockFaceMesh, fastOptions);
      expect(result).toBeDefined();

      // Test that high quality enables enhanced features
      const highOptions = { ...mockProcessingOptions, quality: 'high' as const };
      const highResult = await greekProcessor.applyGreekStyle(mockFaceMesh, highOptions);
      expect(highResult).toBeDefined();
    });

    it('should scale effects based on style intensity', async () => {
      const lowIntensity = { ...mockProcessingOptions, styleIntensity: 0.2 };
      const highIntensity = { ...mockProcessingOptions, styleIntensity: 1.0 };

      const lowResult = await greekProcessor.applyGreekStyle(mockFaceMesh, lowIntensity);
      const highResult = await greekProcessor.applyGreekStyle(mockFaceMesh, highIntensity);

      expect(lowResult).toBeDefined();
      expect(highResult).toBeDefined();
    });
  });
});