import { describe, it, expect } from 'vitest';
import { 
  ProcessingErrorType,
  CapturedPhoto,
  Theme,
  ProcessingRequest,
  ProcessingResult,
  FaceDetectionResult,
  FacialLandmark,
  ProcessingJob,
  ThemeTemplate
} from '../index.js';

describe('Shared Types', () => {
  it('should export ProcessingErrorType enum', () => {
    expect(ProcessingErrorType.NO_FACE_DETECTED).toBe('NO_FACE_DETECTED');
    expect(ProcessingErrorType.MULTIPLE_FACES).toBe('MULTIPLE_FACES');
    expect(ProcessingErrorType.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });

  it('should have correct CapturedPhoto interface structure', () => {
    const photo: CapturedPhoto = {
      id: 'test-id',
      blob: new Blob(['test']),
      dataUrl: 'data:image/jpeg;base64,test',
      timestamp: new Date(),
      dimensions: { width: 1920, height: 1080 }
    };
    
    expect(photo.id).toBe('test-id');
    expect(photo.dimensions.width).toBe(1920);
  });

  it('should have correct Theme interface structure', () => {
    const theme: Theme = {
      id: 'barbarian',
      name: 'Barbarian',
      description: 'Ancient warrior theme',
      category: 'fantasy',
      thumbnailUrl: '/themes/barbarian/thumb.jpg',
      templateUrl: '/themes/barbarian/template.jpg',
      variants: []
    };
    
    expect(theme.name).toBe('Barbarian');
    expect(Array.isArray(theme.variants)).toBe(true);
  });

  it('should have correct ProcessingRequest interface structure', () => {
    const request: ProcessingRequest = {
      photoId: 'photo-123',
      themeId: 'barbarian',
      outputFormat: 'jpeg',
      originalImageUrl: 's3://bucket/photo.jpg'
    };
    
    expect(request.outputFormat).toBe('jpeg');
    expect(request.themeId).toBe('barbarian');
  });

  it('should have correct FaceDetectionResult interface structure', () => {
    const landmark: FacialLandmark = {
      type: 'eyeLeft',
      x: 100,
      y: 150
    };

    const faceResult: FaceDetectionResult = {
      boundingBox: { left: 50, top: 60, width: 200, height: 250 },
      confidence: 0.98,
      landmarks: [landmark],
      quality: {
        brightness: 0.7,
        sharpness: 0.8,
        pose: { roll: 5, yaw: -2, pitch: 3 }
      }
    };
    
    expect(faceResult.confidence).toBe(0.98);
    expect(faceResult.landmarks).toHaveLength(1);
    expect(faceResult.landmarks[0]?.type).toBe('eyeLeft');
  });

  it('should have correct ProcessingJob interface structure', () => {
    const job: ProcessingJob = {
      jobId: 'job-123',
      originalImageUrl: 's3://bucket/original.jpg',
      themeId: 'barbarian',
      status: 'processing',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      outputFormat: 'jpeg'
    };
    
    expect(job.status).toBe('processing');
    expect(job.retryCount).toBe(0);
  });

  it('should have correct ThemeTemplate interface structure', () => {
    const template: ThemeTemplate = {
      id: 'barbarian-template',
      name: 'Barbarian Template',
      description: 'Main barbarian template',
      backgroundImage: 's3://bucket/barbarian-bg.jpg',
      faceRegion: { x: 100, y: 150, width: 200, height: 250, rotation: 0 },
      colorAdjustments: { brightness: 1.0, contrast: 1.1, saturation: 1.05, hue: 0 },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    expect(template.isActive).toBe(true);
    expect(template.faceRegion.width).toBe(200);
    expect(template.colorAdjustments.contrast).toBe(1.1);
  });
});