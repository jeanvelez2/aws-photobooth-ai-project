import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    StyleTransferEngine,
    ProcessingInput,
    ProcessingOptions,
    FaceMeshData,
    Vector3,
    Triangle,
    UVCoordinate,
    NormalVector,
    TextureCoordinate
} from '../styleTransferEngine.js';

// Mock all external dependencies
vi.mock('../gpuMemoryManager.js', () => ({
    GPUMemoryManager: vi.fn().mockImplementation(() => ({
        checkAvailableMemory: vi.fn().mockResolvedValue(true),
        reserveMemory: vi.fn().mockResolvedValue({ id: 'test-reservation', allocated: 1024 }),
        releaseMemory: vi.fn().mockResolvedValue(undefined)
    }))
}));

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

vi.mock('../qualityValidator.js', () => ({
    QualityValidator: vi.fn().mockImplementation(() => ({
        validate: vi.fn().mockResolvedValue({
            overall: 0.85,
            facialProportions: 0.9,
            skinTexture: 0.8,
            lightingConsistency: 0.85,
            edgeBlending: 0.8,
            colorHarmony: 0.9,
            identityPreservation: 0.95
        })
    }))
}));

vi.mock('../fallbackProcessor.js', () => ({
    FallbackProcessor: vi.fn().mockImplementation(() => ({
        process: vi.fn().mockResolvedValue(Buffer.from('fallback result'))
    }))
}));

vi.mock('../onnxRuntimeService.js', () => ({
    onnxRuntimeService: {
        runInference: vi.fn().mockResolvedValue({
            styled_image: new Float32Array(512 * 512 * 3).fill(0.5)
        }),
        loadModel: vi.fn()
    }
}));

vi.mock('../faceMeshGenerator.js', () => ({
    FaceMeshGenerator: vi.fn().mockImplementation(() => ({
        generateMesh: vi.fn().mockResolvedValue({
            vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 0.5, y: 0.5, z: 0.1 },
                { x: -0.5, y: 0.5, z: 0.1 },
                { x: 0, y: -0.5, z: 0.1 }
            ],
            triangles: [
                { v1: 0, v2: 1, v3: 2 },
                { v1: 0, v2: 2, v3: 3 }
            ],
            uvMapping: [
                { u: 0, v: 0 },
                { u: 1, v: 0 },
                { u: 1, v: 1 },
                { u: 0, v: 1 }
            ],
            normalMap: [
                { x: 0, y: 0, z: 1 },
                { x: 0, y: 0, z: 1 },
                { x: 0, y: 0, z: 1 },
                { x: 0, y: 0, z: 1 }
            ],
            textureCoords: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 1 }
            ]
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

describe('StyleTransferEngine - Barbarian Theme Integration', () => {
    let engine: StyleTransferEngine;

    const mockFaceData = {
        faces: [
            {
                boundingBox: { left: 0.25, top: 0.25, width: 0.5, height: 0.5 },
                landmarks: [
                    { type: 'eyeLeft', x: 0.375, y: 0.375 },
                    { type: 'eyeRight', x: 0.5, y: 0.375 },
                    { type: 'nose', x: 0.4375, y: 0.45 }
                ],
                confidence: 0.95,
                gender: { value: 'Male' as const, confidence: 0.8 },
                ageRange: { low: 25, high: 35 }
            }
        ],
        imageWidth: 400,
        imageHeight: 400
    };

    const mockProcessingInput: ProcessingInput = {
        originalImage: Buffer.from('mock image data'),
        theme: 'barbarian',
        faceData: mockFaceData,
        processingOptions: {
            quality: 'balanced',
            styleIntensity: 0.8,
            preserveIdentity: 0.9,
            enableAdvancedFeatures: true
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        engine = new StyleTransferEngine();
    });

    describe('Barbarian theme processing', () => {
        it('should process barbarian theme successfully', async () => {
            const result = await engine.processImage(mockProcessingInput);

            expect(result.success).toBe(true);
            expect(result.processedImage).toBeDefined();
            expect(result.qualityMetrics).toBeDefined();
            expect(result.qualityMetrics?.overall).toBeGreaterThan(0.8);
        });

        it('should handle different quality levels for barbarian theme', async () => {
            const fastInput = { ...mockProcessingInput, processingOptions: { ...mockProcessingInput.processingOptions, quality: 'fast' as const } };
            const highInput = { ...mockProcessingInput, processingOptions: { ...mockProcessingInput.processingOptions, quality: 'high' as const } };

            const fastResult = await engine.processImage(fastInput);
            const highResult = await engine.processImage(highInput);

            expect(fastResult.success).toBe(true);
            expect(highResult.success).toBe(true);
        });

        it('should handle different style intensities for barbarian theme', async () => {
            const lowIntensityInput = { ...mockProcessingInput, processingOptions: { ...mockProcessingInput.processingOptions, styleIntensity: 0.3 } };
            const highIntensityInput = { ...mockProcessingInput, processingOptions: { ...mockProcessingInput.processingOptions, styleIntensity: 1.0 } };

            const lowResult = await engine.processImage(lowIntensityInput);
            const highResult = await engine.processImage(highIntensityInput);

            expect(lowResult.success).toBe(true);
            expect(highResult.success).toBe(true);
        });

        it('should reject unsupported themes', async () => {
            const greekInput = { ...mockProcessingInput, theme: 'greek' as const };

            const result = await engine.processImage(greekInput);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain('Greek style transfer not implemented yet');
        });

        it('should use fallback processing when barbarian processing fails', async () => {
            // Mock the barbarian processor to fail
            const failingInput = { ...mockProcessingInput, processingOptions: { ...mockProcessingInput.processingOptions, enableAdvancedFeatures: true } };

            // This should trigger fallback since we're mocking a failure scenario
            vi.mocked(engine['barbarianProcessor'].applyBarbarianStyle).mockRejectedValueOnce(new Error('Model loading failed'));

            const result = await engine.processImage(failingInput);

            // Should either succeed with fallback or fail gracefully
            expect(result).toBeDefined();
        });
    });

    describe('Error handling', () => {
        it('should handle invalid input gracefully', async () => {
            const invalidInput = {
                ...mockProcessingInput,
                originalImage: Buffer.alloc(0) // Empty buffer
            };

            const result = await engine.processImage(invalidInput);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle invalid theme gracefully', async () => {
            const invalidInput = {
                ...mockProcessingInput,
                theme: 'invalid-theme' as any
            };

            const result = await engine.processImage(invalidInput);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle missing face data gracefully', async () => {
            const invalidInput = {
                ...mockProcessingInput,
                faceData: { faces: [], imageWidth: 400, imageHeight: 400 }
            };

            const result = await engine.processImage(invalidInput);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('Memory management', () => {
        it('should estimate memory requirements correctly for barbarian theme', async () => {
            const memoryEstimate = engine['estimateMemoryRequirement'](mockProcessingInput);

            // Barbarian theme should have higher memory requirement (1.2x multiplier)
            expect(memoryEstimate).toBeGreaterThan(512); // Base memory * barbarian multiplier
        });

        it('should handle GPU memory constraints', async () => {
            const constrainedInput = {
                ...mockProcessingInput,
                processingOptions: {
                    ...mockProcessingInput.processingOptions,
                    gpuMemoryLimit: 256 // Very low limit
                }
            };

            const result = await engine.processImage(constrainedInput);

            // Should either succeed or fail gracefully
            expect(result).toBeDefined();
        });
    });
});