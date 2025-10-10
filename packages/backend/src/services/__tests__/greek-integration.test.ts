import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StyleTransferEngine } from '../styleTransferEngine.js';

// Mock all external dependencies
vi.mock('../gpuMemoryManager.js', () => ({
  GPUMemoryManager: vi.fn().mockImplementation(() => ({
    checkAvailableMemory: vi.fn().mockResolvedValue(true),
    reserveMemory: vi.fn().mockResolvedValue({ id: 'mem-123', allocated: 1024 }),
    releaseMemory: vi.fn().mockResolvedValue(true)
  }))
}));

vi.mock('../modelManager.js', () => ({
  ModelManager: vi.fn().mockImplementation(() => ({
    getModel: vi.fn().mockResolvedValue({
      modelPath: '/mock/model.onnx',
      isLoaded: true
    })
  }))
}));

vi.mock('../qualityValidator.js', () => ({
  QualityValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn().mockResolvedValue({
      overall: 0.85,
      facialProportions: 0.9,
      skinTexture: 0.88,
      lightingConsistency: 0.82,
      edgeBlending: 0.8,
      colorHarmony: 0.87,
      identityPreservation: 0.9
    })
  }))
}));

vi.mock('../fallbackProcessor.js', () => ({
  FallbackProcessor: vi.fn().mockImplementation(() => ({
    process: vi.fn().mockResolvedValue(Buffer.from('fallback-result'))
  }))
}));

vi.mock('../barbarianThemeProcessor.js', () => ({
  BarbarianThemeProcessor: vi.fn().mockImplementation(() => ({
    applyBarbarianStyle: vi.fn(),
    adaptBarbarianTexture: vi.fn(),
    adaptBarbarianLighting: vi.fn()
  }))
}));

vi.mock('../greekThemeProcessor.js', () => ({
  GreekThemeProcessor: vi.fn().mockImplementation(() => ({
    applyGreekStyle: vi.fn().mockResolvedValue({
      styledMesh: {
        vertices: [{ x: 0, y: 0, z: 0 }],
        triangles: [{ v1: 0, v2: 1, v3: 2 }],
        uvMapping: [{ u: 0.5, v: 0.5 }],
        normalMap: [{ x: 0, y: 0, z: 1 }],
        textureCoords: [{ x: 0.5, y: 0.5 }]
      },
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
  }))
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Greek Theme Integration Test', () => {
  let styleEngine: StyleTransferEngine;

  beforeEach(() => {
    styleEngine = new StyleTransferEngine();

    // Mock the pipeline methods
    (styleEngine as any).preprocess = vi.fn().mockResolvedValue({
      normalizedImage: Buffer.from('normalized'),
      faceRegion: {
        bounds: { x: 100, y: 100, width: 200, height: 200 },
        landmarks: [],
        pose: { yaw: 0, pitch: 0, roll: 0 },
        quality: { sharpness: 0.8, brightness: 0.7, contrast: 0.6, symmetry: 0.9 }
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
  });

  it('should successfully process Greek theme', async () => {
    const mockInput = {
      originalImage: Buffer.from('mock-image-data'),
      theme: 'greek' as const,
      faceData: {
        faces: [{
          boundingBox: { left: 0.2, top: 0.2, width: 0.4, height: 0.4 },
          landmarks: [
            { type: 'eyeLeft', x: 0.3, y: 0.25 },
            { type: 'eyeRight', x: 0.5, y: 0.25 }
          ],
          confidence: 0.92,
          gender: { value: 'Female' as const, confidence: 0.8 },
          ageRange: { low: 25, high: 35 }
        }],
        imageWidth: 512,
        imageHeight: 512,
        processingTimeMs: 150,
        imageMetadata: { width: 512, height: 512, channels: 3, colorSpace: 'RGB', hasAlpha: false }
      },
      processingOptions: {
        quality: 'balanced' as const,
        styleIntensity: 0.8,
        preserveIdentity: 0.9,
        enableAdvancedFeatures: true
      }
    };

    const result = await styleEngine.processImage(mockInput);

    expect(result.success).toBe(true);
    expect(result.processedImage).toBeDefined();
    expect(result.qualityMetrics).toBeDefined();
    expect(result.processingTimeMs).toBeGreaterThan(0);

    // Verify Greek-specific quality metrics
    expect(result.qualityMetrics?.overall).toBeGreaterThan(0.8);
    expect(result.qualityMetrics?.identityPreservation).toBeGreaterThan(0.8);
  });

  it('should validate Greek theme input correctly', () => {
    const validInput = {
      originalImage: Buffer.from('test-image'),
      theme: 'greek' as const,
      faceData: {
        faces: [{
          boundingBox: { x: 0, y: 0, width: 100, height: 100 },
          landmarks: [],
          confidence: 0.9,
          pose: { yaw: 0, pitch: 0, roll: 0 },
          quality: { sharpness: 0.8, brightness: 0.7, contrast: 0.6, symmetry: 0.9 }
        }],
        processingTimeMs: 100,
        imageMetadata: { width: 512, height: 512, channels: 3, colorSpace: 'RGB', hasAlpha: false }
      },
      processingOptions: {
        quality: 'balanced' as const,
        styleIntensity: 0.8,
        preserveIdentity: 0.9,
        enableAdvancedFeatures: true
      }
    };

    expect(() => (styleEngine as any).validateInput(validInput)).not.toThrow();
  });

  it('should estimate memory correctly for Greek theme', () => {
    const input = {
      originalImage: Buffer.from('test'),
      theme: 'greek' as const,
      faceData: { faces: [], processingTimeMs: 0, imageMetadata: { width: 512, height: 512, channels: 3, colorSpace: 'RGB', hasAlpha: false } },
      processingOptions: { quality: 'balanced' as const, styleIntensity: 0.8, preserveIdentity: 0.9, enableAdvancedFeatures: true }
    };

    const memoryEstimate = (styleEngine as any).estimateMemoryRequirement(input);
    
    expect(memoryEstimate).toBeGreaterThan(0);
    expect(memoryEstimate).toBe(768); // Base memory for Greek theme (512 * 1.5 * 1.0)
  });
});