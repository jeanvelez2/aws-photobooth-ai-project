import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DetectFacesCommand } from '@aws-sdk/client-rekognition';
import { FaceDetectionService } from './faceDetection.js';
import { rekognitionClient } from './aws.js';

// Mock the AWS client
vi.mock('./aws.js', () => ({
  rekognitionClient: {
    send: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FaceDetectionService', () => {
  let faceDetectionService: FaceDetectionService;
  let mockSend: any;

  beforeEach(() => {
    faceDetectionService = new FaceDetectionService();
    mockSend = vi.mocked(rekognitionClient.send);
    vi.clearAllMocks();
  });

  describe('detectFace', () => {
    const mockImageBuffer = Buffer.from('mock-image-data');

    it('should successfully detect a face with valid data', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99.5,
            BoundingBox: {
              Left: 0.2,
              Top: 0.1,
              Width: 0.4,
              Height: 0.6,
            },
            Landmarks: [
              { Type: 'eyeLeft', X: 0.3, Y: 0.25 },
              { Type: 'eyeRight', X: 0.5, Y: 0.25 },
              { Type: 'nose', X: 0.4, Y: 0.35 },
              { Type: 'mouthLeft', X: 0.35, Y: 0.45 },
              { Type: 'mouthRight', X: 0.45, Y: 0.45 },
              { Type: 'chinBottom', X: 0.4, Y: 0.6 },
              { Type: 'leftEyeBrowLeft', X: 0.25, Y: 0.2 },
              { Type: 'leftEyeBrowRight', X: 0.35, Y: 0.2 },
              { Type: 'leftEyeBrowUp', X: 0.3, Y: 0.18 },
              { Type: 'rightEyeBrowLeft', X: 0.45, Y: 0.2 },
              { Type: 'rightEyeBrowRight', X: 0.55, Y: 0.2 },
              { Type: 'rightEyeBrowUp', X: 0.5, Y: 0.18 },
              { Type: 'leftEyeLeft', X: 0.28, Y: 0.25 },
              { Type: 'leftEyeRight', X: 0.32, Y: 0.25 },
              { Type: 'leftEyeUp', X: 0.3, Y: 0.23 },
              { Type: 'leftEyeDown', X: 0.3, Y: 0.27 },
              { Type: 'rightEyeLeft', X: 0.48, Y: 0.25 },
              { Type: 'rightEyeRight', X: 0.52, Y: 0.25 },
              { Type: 'rightEyeUp', X: 0.5, Y: 0.23 },
              { Type: 'rightEyeDown', X: 0.5, Y: 0.27 },
              { Type: 'noseLeft', X: 0.38, Y: 0.35 },
              { Type: 'noseRight', X: 0.42, Y: 0.35 },
              { Type: 'mouthUp', X: 0.4, Y: 0.43 },
              { Type: 'mouthDown', X: 0.4, Y: 0.47 },
              { Type: 'leftPupil', X: 0.3, Y: 0.25 },
              { Type: 'rightPupil', X: 0.5, Y: 0.25 },
              { Type: 'upperJawlineLeft', X: 0.25, Y: 0.4 },
              { Type: 'midJawlineLeft', X: 0.22, Y: 0.5 },
              { Type: 'midJawlineRight', X: 0.58, Y: 0.5 },
              { Type: 'upperJawlineRight', X: 0.55, Y: 0.4 },
            ],
            Quality: {
              Brightness: 50,
              Sharpness: 80,
            },
            Pose: {
              Roll: 5,
              Yaw: -2,
              Pitch: 3,
            },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await faceDetectionService.detectFace(mockImageBuffer);

      expect(result).toEqual({
        boundingBox: {
          left: 0.2,
          top: 0.1,
          width: 0.4,
          height: 0.6,
        },
        confidence: 99.5,
        landmarks: expect.arrayContaining([
          { type: 'eyeLeft', x: 0.3, y: 0.25 },
          { type: 'eyeRight', x: 0.5, y: 0.25 },
          { type: 'nose', x: 0.4, y: 0.35 },
        ]),
        quality: {
          brightness: 50,
          sharpness: 80,
          pose: {
            roll: 5,
            yaw: -2,
            pitch: 3,
          },
        },
      });

      expect(result.landmarks).toHaveLength(30); // All landmarks should be mapped
      expect(mockSend).toHaveBeenCalledWith(expect.any(DetectFacesCommand));
    });

    it('should throw NO_FACE_DETECTED when no faces are found', async () => {
      const mockResponse = {
        FaceDetails: [],
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('NO_FACE_DETECTED');
    });

    it('should throw MULTIPLE_FACES when multiple faces are detected', async () => {
      const mockResponse = {
        FaceDetails: [
          { Confidence: 99 },
          { Confidence: 98 },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('MULTIPLE_FACES');
    });

    it('should throw POOR_IMAGE_QUALITY when confidence is below threshold', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 90, // Below 95% threshold
            BoundingBox: { Left: 0.2, Top: 0.1, Width: 0.4, Height: 0.6 },
            Landmarks: [],
            Quality: { Brightness: 50, Sharpness: 80 },
            Pose: { Roll: 0, Yaw: 0, Pitch: 0 },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('POOR_IMAGE_QUALITY');
    });

    it('should throw FACE_TOO_SMALL when face bounding box is too small', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99,
            BoundingBox: {
              Left: 0.4,
              Top: 0.4,
              Width: 0.05, // Too small (< 10%)
              Height: 0.05,
            },
            Landmarks: Array(30).fill(null).map((_, i) => ({
              Type: 'eyeLeft',
              X: 0.4,
              Y: 0.4,
            })),
            Quality: { Brightness: 50, Sharpness: 80 },
            Pose: { Roll: 0, Yaw: 0, Pitch: 0 },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('FACE_TOO_SMALL');
    });

    it('should throw POOR_IMAGE_QUALITY when insufficient landmarks are detected', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99,
            BoundingBox: { Left: 0.2, Top: 0.1, Width: 0.4, Height: 0.6 },
            Landmarks: [
              { Type: 'eyeLeft', X: 0.3, Y: 0.25 },
              { Type: 'eyeRight', X: 0.5, Y: 0.25 },
            ], // Only 2 landmarks, need 27+
            Quality: { Brightness: 50, Sharpness: 80 },
            Pose: { Roll: 0, Yaw: 0, Pitch: 0 },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('POOR_IMAGE_QUALITY');
    });

    it('should throw POOR_IMAGE_QUALITY when brightness is too low', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99,
            BoundingBox: { Left: 0.2, Top: 0.1, Width: 0.4, Height: 0.6 },
            Landmarks: Array(30).fill(null).map((_, i) => ({
              Type: 'eyeLeft',
              X: 0.4,
              Y: 0.4,
            })),
            Quality: {
              Brightness: 10, // Too low (< 20)
              Sharpness: 80,
            },
            Pose: { Roll: 0, Yaw: 0, Pitch: 0 },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('POOR_IMAGE_QUALITY');
    });

    it('should throw POOR_IMAGE_QUALITY when brightness is too high', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99,
            BoundingBox: { Left: 0.2, Top: 0.1, Width: 0.4, Height: 0.6 },
            Landmarks: Array(30).fill(null).map((_, i) => ({
              Type: 'eyeLeft',
              X: 0.4,
              Y: 0.4,
            })),
            Quality: {
              Brightness: 90, // Too high (> 80)
              Sharpness: 80,
            },
            Pose: { Roll: 0, Yaw: 0, Pitch: 0 },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('POOR_IMAGE_QUALITY');
    });

    it('should throw POOR_IMAGE_QUALITY when sharpness is too low', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99,
            BoundingBox: { Left: 0.2, Top: 0.1, Width: 0.4, Height: 0.6 },
            Landmarks: Array(30).fill(null).map((_, i) => ({
              Type: 'eyeLeft',
              X: 0.4,
              Y: 0.4,
            })),
            Quality: {
              Brightness: 50,
              Sharpness: 30, // Too low (< 50)
            },
            Pose: { Roll: 0, Yaw: 0, Pitch: 0 },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('POOR_IMAGE_QUALITY');
    });

    it('should throw EXTREME_POSE when head pose angles are too extreme', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99,
            BoundingBox: { Left: 0.2, Top: 0.1, Width: 0.4, Height: 0.6 },
            Landmarks: Array(30).fill(null).map((_, i) => ({
              Type: 'eyeLeft',
              X: 0.4,
              Y: 0.4,
            })),
            Quality: { Brightness: 50, Sharpness: 80 },
            Pose: {
              Roll: 45, // Too extreme (> 30 degrees)
              Yaw: 0,
              Pitch: 0,
            },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('EXTREME_POSE');
    });

    it('should throw INTERNAL_ERROR when AWS Rekognition fails', async () => {
      mockSend.mockRejectedValue(new Error('AWS Service Error'));

      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('INTERNAL_ERROR');
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99,
            // Missing BoundingBox, Landmarks, Quality, Pose - should use defaults
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      // Should throw FACE_TOO_SMALL due to default bounding box values
      await expect(faceDetectionService.detectFace(mockImageBuffer)).rejects.toThrow('FACE_TOO_SMALL');
    });

    it('should filter out landmarks with missing coordinates', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99,
            BoundingBox: { Left: 0.2, Top: 0.1, Width: 0.4, Height: 0.6 },
            Landmarks: [
              { Type: 'eyeLeft', X: 0.3, Y: 0.25 },
              { Type: 'eyeRight' }, // Missing X, Y coordinates
              { Type: 'nose', X: 0.4 }, // Missing Y coordinate
              ...Array(28).fill(null).map(() => ({
                Type: 'eyeLeft',
                X: 0.4,
                Y: 0.4,
              })),
            ],
            Quality: { Brightness: 50, Sharpness: 80 },
            Pose: { Roll: 0, Yaw: 0, Pitch: 0 },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await faceDetectionService.detectFace(mockImageBuffer);
      
      // Should have filtered out invalid landmarks but still have enough valid ones
      expect(result.landmarks.length).toBeGreaterThanOrEqual(27);
      expect(result.landmarks.every(landmark => 
        typeof landmark.x === 'number' && typeof landmark.y === 'number'
      )).toBe(true);
    });

    it('should use fallback landmark type for unknown types', async () => {
      const mockResponse = {
        FaceDetails: [
          {
            Confidence: 99,
            BoundingBox: { Left: 0.2, Top: 0.1, Width: 0.4, Height: 0.6 },
            Landmarks: [
              { Type: 'unknownLandmarkType', X: 0.3, Y: 0.25 },
              ...Array(29).fill(null).map(() => ({
                Type: 'eyeLeft',
                X: 0.4,
                Y: 0.4,
              })),
            ],
            Quality: { Brightness: 50, Sharpness: 80 },
            Pose: { Roll: 0, Yaw: 0, Pitch: 0 },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await faceDetectionService.detectFace(mockImageBuffer);
      
      // Unknown landmark type should be filtered out, leaving only valid ones
      expect(result.landmarks.length).toBe(29);
      expect(result.landmarks.every(landmark => landmark.type === 'eyeLeft')).toBe(true);
    });
  });
});