import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StyleTransferEngine, ProcessingInput, ProcessingOptions } from '../styleTransferEngine.js';
import { FaceDetectionResult } from '../faceDetectionService.js';

// Mock all dependencies
vi.mock('../gpuMemoryManager.js');
vi.mock('../modelManager.js');
vi.mock('../qualityValidator.js');
vi.mock('../fallbackProcessor.js');
vi.mock('../barbarianThemeProcessor.js');
vi.mock('../greekThemeProcessor.js');
vi.mock('../onnxRuntimeService.js');
vi.mock('../modelStorageService.js');
vi.mock('../faceDetectionService.js');
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('StyleTransferEngine - Greek Theme Integration', () => {
  let styleEngine: StyleTransferEngine;
  let mockProcessingInput: ProcessingInput;
  let mockFaceData: FaceDetectionResult;
  let mockProcessingOptions: ProcessingOptions;

  beforeEach(() => {
    styleEngine = new StyleTransferEngine();

    // Mock face detection result
    mockFaceData = {
      faces: [
        {
          boundingBox: { left: 0.2, top: 0.2, width: 0.4, height: 0.4 },
          landmarks: [
            { type: 'eyeLeft', x: 0.3, y: 0.25 },
            { type: 'eyeRight', x: 0.5, y: 0.25 },
            { type: 'nose', x: 0.4, y: 0.32 },
            { type: 'mouth', x: 0.4, y: 0.44 }
          ],
          confidence: 0.92,
          gender: { value: 'Female' as const, confidence: 0.8 },
          ageRange: { low: 25, high: 35 }
        }
      ],
      imageWidth: 512,
      imageHeight: 512
    };

    // Mock processing options
    mockProcessingOptions = {
      quality: 'balanced',
      styleIntensity: 0.8,
      preserveIdentity: 0.9,
      enableAdvancedFeatures: true,
      outputFormat: 'jpeg',
      targetWidth: 512,
      targetHeight: 512,
      gpuMemoryLimit: 2048,
      timeoutMs: 30000
    };

    // Mock processing input
    mockProcessingInput = {
      originalImage: Buffer.from('mock-image-data'),
      theme: 'greek',
      faceData: mockFaceData,
      processingOptions: mockProcessingOptions,
      requestId: 'test-request-123'
    };
  });

  describe('Greek theme processing', () => {
    it('should process Greek theme successfully', async () => {
      // Mock the Greek processor methods
      const mockGreekProcessor = {
        applyGreekStyle: vi.fn().mockResolvedValue({
          styledMesh: {
            vertices: [{ x: 0, y: 0, z: 0 }],
            triangles: [{ v1: 0, v2: 1, v3: 2 }],
            uvMapping: [{ u: 0.5, v: 0.5 }],
            normalMap: [{ x: 0, y: 0, z: 1 }],
            textureCoords: [{ x: 0.5, y: 0.5 }]
          },
          styleFeatures: {
            skinTone: { r: 0.9, g: 0.87, b: 0.82 }, // Marble-like
            hairColor: { r: 0.7, g: 0.5, b: 0.3 }, // Golden-brown
            eyeColor: { r: 0.4, g: 0.5, b: 0.7 }, // Noble blue
            facialStructure: {
              jawStrength: 0.7,
              cheekboneProminence: 0.8,
              eyeSize: 1.1,
              noseShape: 1.05,
              lipFullness: 0.95
            },
            expressionIntensity: 0.6 // Serene
          },
          transformationMatrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
        }),
        adaptGreekTexture: vi.fn().mockResolvedValue({
          texturedMesh: {
            vertices: [{ x: 0, y: 0, z: 0 }],
            triangles: [{ v1: 0, v2: 1, v3: 2 }],
            uvMapping: [{ u: 0.5, v: 0.5 }],
            normalMap: [{ x: 0, y: 0, z: 1 }],
            textureCoords: [{ x: 0.5, y: 0.5 }]
          },
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
        }),
        adaptGreekLighting: vi.fn().mockResolvedValue({
          finalMesh: {
            vertices: [{ x: 0, y: 0, z: 0 }],
            triangles: [{ v1: 0, v2: 1, v3: 2 }],
            uvMapping: [{ u: 0.5, v: 0.5 }],
            normalMap: [{ x: 0, y: 0, z: 1 }],
            textureCoords: [{ x: 0.5, y: 0.5 }]
          },
          lightingData: {
            primaryLight: {
              direction: { x: 0.4, y: -0.3, z: 0.8 },
              color: { r: 1.0, g: 0.98, b: 0.95 },
              intensity: 0.8,
              type: 'directional' as const
            },
            ambientLight: {
              color: { r: 0.95, g: 0.96, b: 0.98 },
              intensity: 0.5
            },
            shadows: [
              { position: { x: 0.15, y: -0.2, z: 0 }, intensity: 0.3, softness: 0.8 }
            ]
          },
          atmosphericEffects: {
            particles: [
              {
                type: 'dust' as const,
                density: 0.1,
                color: { r: 0.9, g: 0.9, b: 0.85 },
                motion: { x: 0.02, y: 0.01, z: 0 }
              }
            ],
            mist: {
              density: 0.05,
              color: { r: 0.95, g: 0.96, b: 0.98 },
              height: 0.2
            },
            colorGrading: {
              shadows: { r: 0.9, g: 0.92, b: 0.95 },
              midtones: { r: 1.0, g: 0.98, b: 0.96 },
              highlights: { r: 1.05, g: 1.02, b: 0.98 },
              saturation: 0.9,
              contrast: 0.8
            }
          }
        })
      };

      // Replace the Greek processor in the engine
      (styleEngine as any).greekProcessor = mockGreekProcessor;

      // Mock other required methods
      (styleEngine as any).preprocess = vi.fn().mockResolvedValue({
        normalizedImage: Buffer.from('normalized'),
        faceRegion: {
          bounds: { x: 100, y: 100, width: 200, height: 200 },
          landmarks: mockFaceData.faces[0].landmarks
        },
        backgroundRegion: Buffer.from('background'),
        metadata: { width: 512, height: 512, channels: 3, colorSpace: 'RGB', hasAlpha: false }
      });

      (styleEngine as any).generateFaceMesh = vi.fn().mockResolvedValue({
        vertices: [{ x: 0, y: 0, z: 0 }],
        triangles: [{ v1: 0, v2: 1, v3: 2 }],
        uvMapping: [{ u: 0.5, v: 0.5 }],
        normalMap: [{ x: 0, y: 0, z: 1 }],
        textureCoords: [{ x: 0.5, y: 0.5 }]
      });

      (styleEngine as any).postprocess = vi.fn().mockResolvedValue(
        Buffer.from('processed-greek-image')
      );

      // Mock GPU memory manager
      (styleEngine as any).gpuMemoryManager = {
        checkAvailableMemory: vi.fn().mockResolvedValue(true),
        reserveMemory: vi.fn().mockResolvedValue({ id: 'mem-123', allocated: 1024 }),
        releaseMemory: vi.fn().mockResolvedValue(true)
      };

      // Mock quality validator
      (styleEngine as any).qualityValidator = {
        validate: vi.fn().mockResolvedValue({
          overall: 0.85,
          facialProportions: 0.9,
          skinTexture: 0.88,
          lightingConsistency: 0.82,
          edgeBlending: 0.8,
          colorHarmony: 0.87,
          identityPreservation: 0.9
        })
      };

      const result = await styleEngine.processImage(mockProcessingInput);

      expect(result.success).toBe(true);
      expect(result.processedImage).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);

      // Verify Greek processor methods were called
      expect(mockGreekProcessor.applyGreekStyle).toHaveBeenCalledWith(
        expect.any(Object),
        mockProcessingOptions
      );
      expect(mockGreekProcessor.adaptGreekTexture).toHaveBeenCalledWith(
        expect.any(Object),
        mockProcessingOptions
      );
      expect(mockGreekProcessor.adaptGreekLighting).toHaveBeenCalledWith(
        expect.any(Object),
        mockProcessingInput.originalImage
      );
    });

    it('should validate Greek theme input correctly', async () => {
      const validInput = { ...mockProcessingInput };
      
      // This should not throw
      expect(() => (styleEngine as any).validateInput(validInput)).not.toThrow();

      // Test invalid theme
      const invalidThemeInput = { ...mockProcessingInput, theme: 'invalid' as any };
      expect(() => (styleEngine as any).validateInput(invalidThemeInput)).toThrow();
    });

    it('should estimate memory requirements for Greek theme', () => {
      const memoryEstimate = (styleEngine as any).estimateMemoryRequirement(mockProcessingInput);
      
      expect(memoryEstimate).toBeGreaterThan(0);
      expect(typeof memoryEstimate).toBe('number');
      
      // Greek theme should have reasonable memory requirements
      expect(memoryEstimate).toBeLessThan(2000); // Should be less than 2GB
    });

    it('should handle Greek theme processing errors gracefully', async () => {
      // Mock Greek processor to throw error
      const mockGreekProcessor = {
        applyGreekStyle: vi.fn().mockRejectedValue(new Error('Greek processing failed')),
        adaptGreekTexture: vi.fn(),
        adaptGreekLighting: vi.fn()
      };

      (styleEngine as any).greekProcessor = mockGreekProcessor;

      // Mock other required methods
      (styleEngine as any).preprocess = vi.fn().mockResolvedValue({});
      (styleEngine as any).generateFaceMesh = vi.fn().mockResolvedValue({});
      (styleEngine as any).gpuMemoryManager = {
        checkAvailableMemory: vi.fn().mockResolvedValue(true),
        reserveMemory: vi.fn().mockResolvedValue({ id: 'mem-123', allocated: 1024 }),
        releaseMemory: vi.fn().mockResolvedValue(true)
      };

      const result = await styleEngine.processImage(mockProcessingInput);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Greek processing failed');
    });

    it('should support different quality levels for Greek theme', async () => {
      const qualities: Array<'fast' | 'balanced' | 'high'> = ['fast', 'balanced', 'high'];
      
      for (const quality of qualities) {
        const input = {
          ...mockProcessingInput,
          processingOptions: {
            ...mockProcessingOptions,
            quality
          }
        };

        const memoryEstimate = (styleEngine as any).estimateMemoryRequirement(input);
        expect(memoryEstimate).toBeGreaterThan(0);
        
        // Memory requirements should vary by quality
        if (quality === 'fast') {
          expect(memoryEstimate).toBeLessThan(1000);
        } else if (quality === 'high') {
          expect(memoryEstimate).toBeGreaterThan(800);
        }
      }
    });

    it('should respect style intensity for Greek theme', () => {
      const lowIntensityInput = {
        ...mockProcessingInput,
        processingOptions: {
          ...mockProcessingOptions,
          styleIntensity: 0.3
        }
      };

      const highIntensityInput = {
        ...mockProcessingInput,
        processingOptions: {
          ...mockProcessingOptions,
          styleIntensity: 1.0
        }
      };

      // Both should be valid
      expect(() => (styleEngine as any).validateInput(lowIntensityInput)).not.toThrow();
      expect(() => (styleEngine as any).validateInput(highIntensityInput)).not.toThrow();
    });

    it('should handle Greek theme lighting adaptation correctly', async () => {
      const mockTexturedResult = {
        texturedMesh: {
          vertices: [{ x: 0, y: 0, z: 0 }],
          triangles: [{ v1: 0, v2: 1, v3: 2 }],
          uvMapping: [{ u: 0.5, v: 0.5 }],
          normalMap: [{ x: 0, y: 0, z: 1 }],
          textureCoords: [{ x: 0.5, y: 0.5 }]
        },
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

      const mockGreekProcessor = {
        adaptGreekLighting: vi.fn().mockResolvedValue({
          finalMesh: mockTexturedResult.texturedMesh,
          lightingData: {
            primaryLight: {
              direction: { x: 0.4, y: -0.3, z: 0.8 },
              color: { r: 1.0, g: 0.98, b: 0.95 },
              intensity: 0.8,
              type: 'directional' as const
            },
            ambientLight: {
              color: { r: 0.95, g: 0.96, b: 0.98 },
              intensity: 0.5
            },
            shadows: []
          },
          atmosphericEffects: {
            particles: [],
            mist: {
              density: 0.05,
              color: { r: 0.95, g: 0.96, b: 0.98 },
              height: 0.2
            },
            colorGrading: {
              shadows: { r: 0.9, g: 0.92, b: 0.95 },
              midtones: { r: 1.0, g: 0.98, b: 0.96 },
              highlights: { r: 1.05, g: 1.02, b: 0.98 },
              saturation: 0.9,
              contrast: 0.8
            }
          }
        })
      };

      (styleEngine as any).greekProcessor = mockGreekProcessor;
      (styleEngine as any).currentTheme = 'greek';

      const result = await (styleEngine as any).adaptLighting(
        mockTexturedResult, 
        mockProcessingInput.originalImage
      );

      expect(result).toBeDefined();
      expect(mockGreekProcessor.adaptGreekLighting).toHaveBeenCalledWith(
        mockTexturedResult,
        mockProcessingInput.originalImage
      );
    });
  });
});