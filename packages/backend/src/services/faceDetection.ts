import {
  DetectFacesCommand,
  DetectFacesCommandInput,
  DetectFacesCommandOutput,
  Attribute,
  Landmark,
} from '@aws-sdk/client-rekognition';
import { rekognitionClient } from './aws.js';
import { logger } from '../utils/logger.js';
import {
  FaceDetectionResult,
  FacialLandmark,
  QualityMetrics,
} from 'shared';

export class FaceDetectionService {
  private readonly CONFIDENCE_THRESHOLD = 95;
  private readonly MAX_FACES = 1;

  /**
   * Detects faces in an image using AWS Rekognition
   * @param imageBuffer - The image buffer to analyze
   * @returns Promise<FaceDetectionResult> - Face detection results with landmarks and quality metrics
   * @throws Error if no face detected, multiple faces, or processing fails
   */
  async detectFace(imageBuffer: Buffer): Promise<FaceDetectionResult> {
    try {
      logger.info('Starting face detection', {
        imageSize: imageBuffer.length,
        confidenceThreshold: this.CONFIDENCE_THRESHOLD,
      });

      const input: DetectFacesCommandInput = {
        Image: {
          Bytes: imageBuffer,
        },
        Attributes: [
          Attribute.ALL, // This includes landmarks, pose, quality, etc.
        ],
      };

      const command = new DetectFacesCommand(input);
      const response: DetectFacesCommandOutput = await rekognitionClient.send(command);

      if (!response.FaceDetails || response.FaceDetails.length === 0) {
        logger.warn('No faces detected in image');
        throw new Error('NO_FACE_DETECTED');
      }

      if (response.FaceDetails.length > 1) {
        logger.warn('Multiple faces detected', { faceCount: response.FaceDetails.length });
        throw new Error('MULTIPLE_FACES');
      }

      const face = response.FaceDetails[0];
      if (!face) {
        logger.warn('No face data returned from Rekognition');
        throw new Error('NO_FACE_DETECTED');
      }

      // Validate confidence threshold
      if (!face.Confidence || face.Confidence < this.CONFIDENCE_THRESHOLD) {
        logger.warn('Face confidence below threshold', {
          confidence: face.Confidence,
          threshold: this.CONFIDENCE_THRESHOLD,
        });
        throw new Error('POOR_IMAGE_QUALITY');
      }

      // Extract and validate face data
      const faceDetectionResult = this.extractFaceData(face);
      
      // Validate face quality
      this.validateFaceQuality(faceDetectionResult.quality);

      logger.info('Face detection completed successfully', {
        confidence: face.Confidence,
        landmarkCount: faceDetectionResult.landmarks.length,
        quality: faceDetectionResult.quality,
      });

      return faceDetectionResult;
    } catch (error) {
      logger.error('Face detection failed', { error: error instanceof Error ? error.message : error });
      
      // Re-throw known errors as-is
      if (error instanceof Error && [
        'NO_FACE_DETECTED',
        'MULTIPLE_FACES',
        'POOR_IMAGE_QUALITY',
        'FACE_TOO_SMALL',
        'EXTREME_POSE'
      ].includes(error.message)) {
        throw error;
      }
      
      // Wrap unknown errors
      throw new Error('INTERNAL_ERROR');
    }
  }

  /**
   * Extracts facial landmarks from Rekognition response
   * @param landmarks - Rekognition landmarks array
   * @returns FacialLandmark[] - Converted landmarks with proper typing
   */
  private extractLandmarks(landmarks: Landmark[] = []): FacialLandmark[] {
    const landmarkMap: Record<string, FacialLandmark['type']> = {
      'eyeLeft': 'eyeLeft',
      'eyeRight': 'eyeRight',
      'nose': 'nose',
      'mouthLeft': 'mouthLeft',
      'mouthRight': 'mouthRight',
      'chinBottom': 'chinBottom',
      'leftEyeBrowLeft': 'leftEyeBrowLeft',
      'leftEyeBrowRight': 'leftEyeBrowRight',
      'leftEyeBrowUp': 'leftEyeBrowUp',
      'rightEyeBrowLeft': 'rightEyeBrowLeft',
      'rightEyeBrowRight': 'rightEyeBrowRight',
      'rightEyeBrowUp': 'rightEyeBrowUp',
      'leftEyeLeft': 'leftEyeLeft',
      'leftEyeRight': 'leftEyeRight',
      'leftEyeUp': 'leftEyeUp',
      'leftEyeDown': 'leftEyeDown',
      'rightEyeLeft': 'rightEyeLeft',
      'rightEyeRight': 'rightEyeRight',
      'rightEyeUp': 'rightEyeUp',
      'rightEyeDown': 'rightEyeDown',
      'noseLeft': 'noseLeft',
      'noseRight': 'noseRight',
      'mouthUp': 'mouthUp',
      'mouthDown': 'mouthDown',
      'leftPupil': 'leftPupil',
      'rightPupil': 'rightPupil',
      'upperJawlineLeft': 'upperJawlineLeft',
      'midJawlineLeft': 'midJawlineLeft',
      'midJawlineRight': 'midJawlineRight',
      'upperJawlineRight': 'upperJawlineRight',
    };

    return landmarks
      .filter(landmark => 
        landmark.Type && 
        landmark.X !== undefined && 
        landmark.Y !== undefined &&
        landmarkMap[landmark.Type] // Only include landmarks we can map
      )
      .map(landmark => ({
        type: landmarkMap[landmark.Type!]!,
        x: landmark.X!,
        y: landmark.Y!,
      }));
  }

  /**
   * Validates face quality metrics against thresholds
   * @param quality - Quality metrics to validate
   * @throws Error if quality is below acceptable thresholds
   */
  private validateFaceQuality(quality: QualityMetrics): void {
    const MIN_BRIGHTNESS = 20;
    const MAX_BRIGHTNESS = 80;
    const MIN_SHARPNESS = 50;
    const MAX_POSE_ANGLE = 30; // degrees

    if (quality.brightness < MIN_BRIGHTNESS || quality.brightness > MAX_BRIGHTNESS) {
      logger.warn('Poor lighting conditions', { brightness: quality.brightness });
      throw new Error('POOR_IMAGE_QUALITY');
    }

    if (quality.sharpness < MIN_SHARPNESS) {
      logger.warn('Image too blurry', { sharpness: quality.sharpness });
      throw new Error('POOR_IMAGE_QUALITY');
    }

    const { roll, yaw, pitch } = quality.pose;
    if (Math.abs(roll) > MAX_POSE_ANGLE || Math.abs(yaw) > MAX_POSE_ANGLE || Math.abs(pitch) > MAX_POSE_ANGLE) {
      logger.warn('Extreme head pose detected', { pose: quality.pose });
      throw new Error('EXTREME_POSE');
    }
  }

  /**
   * Extracts complete face data from Rekognition response
   * @param face - Rekognition face details
   * @returns FaceDetectionResult - Structured face detection result
   */
  private extractFaceData(face: any): FaceDetectionResult {
    // Extract bounding box
    const boundingBox = {
      left: face.BoundingBox?.Left || 0,
      top: face.BoundingBox?.Top || 0,
      width: face.BoundingBox?.Width || 0,
      height: face.BoundingBox?.Height || 0,
    };

    // Validate face size (minimum 10% of image width/height)
    if (boundingBox.width < 0.1 || boundingBox.height < 0.1) {
      logger.warn('Face too small', { boundingBox });
      throw new Error('FACE_TOO_SMALL');
    }

    // Extract landmarks
    const landmarks = this.extractLandmarks(face.Landmarks);

    // Validate minimum landmark count (AWS Rekognition typically returns 27+ landmarks)
    if (landmarks.length < 27) {
      logger.warn('Insufficient landmarks detected', { landmarkCount: landmarks.length });
      throw new Error('POOR_IMAGE_QUALITY');
    }

    // Extract quality metrics
    const quality: QualityMetrics = {
      brightness: face.Quality?.Brightness || 0,
      sharpness: face.Quality?.Sharpness || 0,
      pose: {
        roll: face.Pose?.Roll || 0,
        yaw: face.Pose?.Yaw || 0,
        pitch: face.Pose?.Pitch || 0,
      },
    };

    return {
      boundingBox,
      confidence: face.Confidence || 0,
      landmarks,
      quality,
    };
  }
}

export const faceDetectionService = new FaceDetectionService();