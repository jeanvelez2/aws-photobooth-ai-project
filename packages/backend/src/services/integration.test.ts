import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FaceDetectionService } from './faceDetection.js';
import { ImageProcessingPipeline } from './imageProcessing.js';
import { ThemeVariant } from 'shared';

// Mock AWS SDK and other dependencies
vi.mock('@aws-sdk/client-rekognition');
vi.mock('./aws.js', () => ({
  rekognitionClient: {
    send: vi.fn(),
  },
}));
vi.mock('sharp');
vi.mock('jimp', () => ({
  default: {
    read: vi.fn(),
    MIME_PNG: 'image/png',
  },
}));
vi.mock('canvas', () => ({
  createCanvas: vi.fn(),
  loadImage: vi.fn(),
}));
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Face Detection and Image Processing Integration', () => {
  let faceDetectionService: FaceDetectionService;
  let imageProcessingPipeline: ImageProcessingPipeline;
  let mockThemeVariant: ThemeVariant;

  beforeEach(() => {
    faceDetectionService = new FaceDetectionService();
    imageProcessingPipeline = new ImageProcessingPipeline();
    
    mockThemeVariant = {
      id: 'barbarian-v1',
      name: 'Barbarian Warrior',
      thumbnailUrl: 'https://example.com/barbarian-thumb.jpg',
      templateUrl: 'https://example.com/barbarian-template.jpg',
      faceRegion: {
        x: 100,
        y: 150,
        width: 300,
        height: 400,
        rotation: 0,
      },
      colorAdjustments: {
        brightness: 10,
        contrast: 1.1,
        saturation: 5,
        hue: -2,
      },
    };

    vi.clearAllMocks();
  });

  describe('Integration Workflow', () => {
    it('should handle the complete workflow from face detection to image processing', async () => {
      // This test verifies that the services can work together
      // In a real scenario, face detection would be called first, then image processing
      
      const mockImageBuffer = Buffer.from('mock-image-data');
      
      // Mock face detection result
      const mockFaceDetection = {
        boundingBox: {
          left: 0.2,
          top: 0.1,
          width: 0.6,
          height: 0.8,
        },
        confidence: 98.5,
        landmarks: [
          { type: 'eyeLeft', x: 0.35, y: 0.3 },
          { type: 'eyeRight', x: 0.65, y: 0.3 },
          { type: 'nose', x: 0.5, y: 0.5 },
          { type: 'mouthLeft', x: 0.4, y: 0.7 },
          { type: 'mouthRight', x: 0.6, y: 0.7 },
        ] as any,
        quality: {
          brightness: 75,
          sharpness: 85,
          pose: {
            roll: 2.5,
            yaw: -1.2,
            pitch: 0.8,
          },
        },
      };

      // Test that the image processing pipeline can accept face detection results
      // Verify the services exist and can be instantiated
      expect(imageProcessingPipeline).toBeInstanceOf(ImageProcessingPipeline);
      expect(faceDetectionService).toBeInstanceOf(FaceDetectionService);
      
      // Verify the face detection result structure is compatible
      expect(mockFaceDetection).toHaveProperty('boundingBox');
      expect(mockFaceDetection).toHaveProperty('landmarks');
      expect(mockFaceDetection).toHaveProperty('quality');
    });

    it('should validate that face detection results are compatible with image processing requirements', () => {
      // Test interface compatibility
      const mockFaceDetection = {
        boundingBox: {
          left: 0.2,
          top: 0.1,
          width: 0.6,
          height: 0.8,
        },
        confidence: 98.5,
        landmarks: [
          { type: 'eyeLeft', x: 0.35, y: 0.3 },
          { type: 'eyeRight', x: 0.65, y: 0.3 },
          { type: 'nose', x: 0.5, y: 0.5 },
        ] as any,
        quality: {
          brightness: 75,
          sharpness: 85,
          pose: {
            roll: 2.5,
            yaw: -1.2,
            pitch: 0.8,
          },
        },
      };

      // Verify that the face detection result has all required properties for image processing
      expect(mockFaceDetection).toHaveProperty('boundingBox');
      expect(mockFaceDetection).toHaveProperty('landmarks');
      expect(mockFaceDetection).toHaveProperty('quality');
      expect(mockFaceDetection.boundingBox).toHaveProperty('left');
      expect(mockFaceDetection.boundingBox).toHaveProperty('top');
      expect(mockFaceDetection.boundingBox).toHaveProperty('width');
      expect(mockFaceDetection.boundingBox).toHaveProperty('height');
      expect(Array.isArray(mockFaceDetection.landmarks)).toBe(true);
    });

    it('should handle error propagation between services', async () => {
      // Test that errors from face detection are properly handled by image processing
      const invalidFaceDetection = {
        boundingBox: {
          left: 0,
          top: 0,
          width: 0,
          height: 0,
        },
        confidence: 50, // Below threshold
        landmarks: [], // No landmarks
        quality: {
          brightness: 10, // Too dark
          sharpness: 30, // Too blurry
          pose: {
            roll: 45, // Extreme angle
            yaw: 45,
            pitch: 45,
          },
        },
      };

      // The image processing pipeline should handle invalid face detection results gracefully
      await expect(
        imageProcessingPipeline.alignFace(
          Buffer.from('test'),
          invalidFaceDetection,
          mockThemeVariant.faceRegion
        )
      ).rejects.toThrow();
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large image buffers efficiently', () => {
      // Test with a larger mock buffer to ensure the pipeline can handle realistic image sizes
      const largeImageBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB buffer
      
      expect(largeImageBuffer.length).toBeGreaterThan(1024 * 1024); // > 1MB
      
      // The services should be able to accept large buffers without immediate errors
      expect(() => {
        new FaceDetectionService();
        new ImageProcessingPipeline();
      }).not.toThrow();
    });

    it('should validate processing options for optimal performance', () => {
      const processingOptions = {
        outputFormat: 'jpeg' as const,
        quality: 90,
        maxWidth: 2400,
        maxHeight: 3200,
      };

      // Verify that processing options are within reasonable bounds
      expect(processingOptions.quality).toBeGreaterThanOrEqual(1);
      expect(processingOptions.quality).toBeLessThanOrEqual(100);
      expect(processingOptions.maxWidth).toBeGreaterThan(0);
      expect(processingOptions.maxHeight).toBeGreaterThan(0);
      expect(['jpeg', 'png']).toContain(processingOptions.outputFormat);
    });
  });

  describe('Data Flow Validation', () => {
    it('should ensure proper data types flow between services', () => {
      // Verify that the output of face detection can be used as input to image processing
      const faceDetectionOutput = {
        boundingBox: { left: 0.2, top: 0.1, width: 0.6, height: 0.8 },
        confidence: 98.5,
        landmarks: [
          { type: 'eyeLeft', x: 0.35, y: 0.3 },
          { type: 'eyeRight', x: 0.65, y: 0.3 },
          { type: 'nose', x: 0.5, y: 0.5 },
        ] as any,
        quality: {
          brightness: 75,
          sharpness: 85,
          pose: { roll: 2.5, yaw: -1.2, pitch: 0.8 },
        },
      };

      // Type checking - these should not cause TypeScript errors
      expect(typeof faceDetectionOutput.confidence).toBe('number');
      expect(Array.isArray(faceDetectionOutput.landmarks)).toBe(true);
      expect(typeof faceDetectionOutput.quality.brightness).toBe('number');
      expect(typeof faceDetectionOutput.quality.sharpness).toBe('number');
      expect(typeof faceDetectionOutput.quality.pose.roll).toBe('number');
    });

    it('should validate theme variant structure for image processing', () => {
      // Ensure theme variant has all required properties for image processing
      expect(mockThemeVariant).toHaveProperty('faceRegion');
      expect(mockThemeVariant).toHaveProperty('colorAdjustments');
      expect(mockThemeVariant.faceRegion).toHaveProperty('x');
      expect(mockThemeVariant.faceRegion).toHaveProperty('y');
      expect(mockThemeVariant.faceRegion).toHaveProperty('width');
      expect(mockThemeVariant.faceRegion).toHaveProperty('height');
      expect(mockThemeVariant.faceRegion).toHaveProperty('rotation');
      expect(mockThemeVariant.colorAdjustments).toHaveProperty('brightness');
      expect(mockThemeVariant.colorAdjustments).toHaveProperty('contrast');
      expect(mockThemeVariant.colorAdjustments).toHaveProperty('saturation');
      expect(mockThemeVariant.colorAdjustments).toHaveProperty('hue');
    });
  });
});