import { RekognitionClient, DetectFacesCommand, DetectFacesCommandInput } from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export interface FaceDetectionResult {
  faces: Array<{
    boundingBox: {
      width: number;
      height: number;
      left: number;
      top: number;
    };
    landmarks: Array<{
      type: string;
      x: number;
      y: number;
    }>;
    confidence: number;
    gender: {
      value: 'Male' | 'Female';
      confidence: number;
    };
    ageRange: {
      low: number;
      high: number;
    };
  }>;
  imageWidth: number;
  imageHeight: number;
}

export class FaceDetectionService {
  private rekognitionClient: RekognitionClient;
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.rekognitionClient = new RekognitionClient({ region: config.aws.region });
    this.s3Client = new S3Client({ region: config.aws.region });
    this.bucketName = config.aws.s3.bucketName;
    console.log(`[FACE_DETECTION] Initialized with bucket: ${this.bucketName}, region: ${config.aws.region}`);
  }

  private extractS3KeyFromUrl(urlOrKey: string): string {
    console.log(`[FACE_DETECTION] Extracting S3 key from: ${urlOrKey}`);
    
    // If it's already an S3 key (no protocol), return as-is
    if (!urlOrKey.startsWith('http')) {
      console.log(`[FACE_DETECTION] Already an S3 key: ${urlOrKey}`);
      return urlOrKey;
    }

    try {
      const url = new URL(urlOrKey);
      console.log(`[FACE_DETECTION] Parsed URL - hostname: ${url.hostname}, pathname: ${url.pathname}`);
      
      // Handle CloudFront URLs
      if (url.hostname.includes('cloudfront.net')) {
        const key = url.pathname.substring(1); // Remove leading slash
        console.log(`[FACE_DETECTION] CloudFront URL detected, extracted key: ${key}`);
        return key;
      }
      
      // Handle direct S3 URLs
      if (url.hostname.includes('s3.amazonaws.com')) {
        const key = url.pathname.substring(1); // Remove leading slash
        console.log(`[FACE_DETECTION] S3 URL detected, extracted key: ${key}`);
        return key;
      }
      
      // Handle S3 bucket URLs (bucket.s3.region.amazonaws.com)
      if (url.hostname.includes('.s3.') && url.hostname.includes('.amazonaws.com')) {
        const key = url.pathname.substring(1); // Remove leading slash
        console.log(`[FACE_DETECTION] S3 bucket URL detected, extracted key: ${key}`);
        return key;
      }
      
      console.log(`[FACE_DETECTION] Unsupported URL format: ${urlOrKey}`);
      throw new Error(`Unsupported URL format: ${urlOrKey}`);
    } catch (error) {
      console.log(`[FACE_DETECTION] Failed to extract S3 key:`, error);
      throw new Error(`Unable to extract S3 key from URL: ${urlOrKey}`);
    }
  }

  async detectFaces(imageKeyOrUrl: string): Promise<FaceDetectionResult> {
    const imageKey = this.extractS3KeyFromUrl(imageKeyOrUrl);
    console.log(`[FACE_DETECTION] Starting face detection for S3 object: s3://${this.bucketName}/${imageKey}`);
    console.log(`[FACE_DETECTION] Using bucket: ${this.bucketName}, region: ${config.aws.region}`);
    try {
      const input: DetectFacesCommandInput = {
        Image: {
          S3Object: {
            Bucket: this.bucketName,
            Name: imageKey,
          },
        },
        Attributes: ['ALL'],
      };

      console.log(`[FACE_DETECTION] Sending DetectFaces command to Rekognition with input:`, JSON.stringify(input, null, 2));
      const command = new DetectFacesCommand(input);
      const response = await this.rekognitionClient.send(command);
      console.log(`[FACE_DETECTION] Rekognition response received, faces found: ${response.FaceDetails?.length || 0}`);

      if (!response.FaceDetails || response.FaceDetails.length === 0) {
        throw new Error('NO_FACE_DETECTED');
      }

      // Get image dimensions
      const imageMetadata = await this.getImageMetadata(imageKey);

      const faces = response.FaceDetails.map(face => ({
        boundingBox: {
          width: face.BoundingBox?.Width || 0,
          height: face.BoundingBox?.Height || 0,
          left: face.BoundingBox?.Left || 0,
          top: face.BoundingBox?.Top || 0,
        },
        landmarks: (face.Landmarks || []).map(landmark => ({
          type: landmark.Type || '',
          x: landmark.X || 0,
          y: landmark.Y || 0,
        })),
        confidence: face.Confidence || 0,
        gender: {
          value: face.Gender?.Value as 'Male' | 'Female' || 'Male',
          confidence: face.Gender?.Confidence || 0,
        },
        ageRange: {
          low: face.AgeRange?.Low || 18,
          high: face.AgeRange?.High || 65,
        },
      }));

      logger.info('Face detection completed', {
        imageKey,
        facesDetected: faces.length,
        imageWidth: imageMetadata.width,
        imageHeight: imageMetadata.height,
      });

      return {
        faces,
        imageWidth: imageMetadata.width,
        imageHeight: imageMetadata.height,
      };
    } catch (error) {
      console.log(`[FACE_DETECTION] Face detection failed for ${imageKey}:`, error);
      logger.error('Face detection failed', { imageKey, error });
      throw error;
    }
  }

  private async getImageMetadata(imageKey: string): Promise<{ width: number; height: number }> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: imageKey,
      });

      const response = await this.s3Client.send(command);
      
      // For now, return default dimensions
      // In a real implementation, you'd parse the image headers
      return { width: 1024, height: 1024 };
    } catch (error) {
      logger.warn('Could not get image metadata', { imageKey, error });
      return { width: 1024, height: 1024 };
    }
  }

  validateFaceForProcessing(face: FaceDetectionResult['faces'][0]): { valid: boolean; reason?: string } {
    const minConfidence = 85; // Lower confidence threshold
    const minFaceSize = 0.02; // 2% of image (much smaller)

    if (face.confidence < minConfidence) {
      return { valid: false, reason: 'Face confidence too low' };
    }

    const faceArea = face.boundingBox.width * face.boundingBox.height;
    if (faceArea < minFaceSize) {
      return { valid: false, reason: 'Face too small in image' };
    }

    return { valid: true };
  }
}

export const faceDetectionService = new FaceDetectionService();