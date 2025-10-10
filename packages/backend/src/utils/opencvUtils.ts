import cv from 'opencv4nodejs';
import { logger } from './logger.js';

export interface FacialLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface FaceDetectionResult {
  boundingBox: cv.Rect;
  landmarks: FacialLandmark[];
  confidence: number;
}

export interface ImageProcessingOptions {
  targetWidth?: number;
  targetHeight?: number;
  maintainAspectRatio?: boolean;
  interpolation?: number;
}

export class OpenCVUtils {
  private static faceClassifier: cv.CascadeClassifier | null = null;
  private static eyeClassifier: cv.CascadeClassifier | null = null;

  /**
   * Initialize OpenCV classifiers
   */
  static async initialize(): Promise<void> {
    try {
      // Load face detection classifier
      this.faceClassifier = new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_ALT2);
      this.eyeClassifier = new cv.CascadeClassifier(cv.HAAR_EYE);
      
      logger.info('OpenCV classifiers initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenCV classifiers:', error);
      throw error;
    }
  }

  /**
   * Convert buffer to OpenCV Mat
   */
  static bufferToMat(buffer: Buffer): cv.Mat {
    try {
      return cv.imdecode(buffer);
    } catch (error) {
      logger.error('Failed to decode image buffer:', error);
      throw new Error('Invalid image buffer');
    }
  }

  /**
   * Convert OpenCV Mat to buffer
   */
  static matToBuffer(mat: cv.Mat, extension: string = '.jpg', quality: number = 95): Buffer {
    try {
      const encodeParams = extension === '.jpg' 
        ? [cv.IMWRITE_JPEG_QUALITY, quality]
        : [cv.IMWRITE_PNG_COMPRESSION, 9];
      
      return cv.imencode(extension, mat, encodeParams);
    } catch (error) {
      logger.error('Failed to encode Mat to buffer:', error);
      throw new Error('Mat encoding failed');
    }
  }

  /**
   * Detect faces in image
   */
  static detectFaces(image: cv.Mat): FaceDetectionResult[] {
    if (!this.faceClassifier) {
      throw new Error('Face classifier not initialized');
    }

    try {
      // Convert to grayscale for detection
      const grayImage = image.channels === 1 ? image : image.cvtColor(cv.COLOR_BGR2GRAY);
      
      // Detect faces
      const faces = this.faceClassifier.detectMultiScale(grayImage, {
        scaleFactor: 1.1,
        minNeighbors: 3,
        minSize: new cv.Size(30, 30),
      });

      const results: FaceDetectionResult[] = [];

      for (const face of faces.objects) {
        // Extract face region for landmark detection
        const faceRegion = grayImage.getRegion(face);
        
        // Detect eyes within face region for basic landmarks
        const eyes = this.eyeClassifier?.detectMultiScale(faceRegion, {
          scaleFactor: 1.1,
          minNeighbors: 2,
          minSize: new cv.Size(10, 10),
        });

        // Create basic landmarks from eye positions
        const landmarks: FacialLandmark[] = [];
        
        if (eyes && eyes.objects.length >= 2) {
          // Sort eyes by x position (left to right)
          const sortedEyes = eyes.objects.sort((a, b) => a.x - b.x);
          
          // Left eye
          landmarks.push({
            x: face.x + sortedEyes[0].x + sortedEyes[0].width / 2,
            y: face.y + sortedEyes[0].y + sortedEyes[0].height / 2,
          });
          
          // Right eye
          landmarks.push({
            x: face.x + sortedEyes[1].x + sortedEyes[1].width / 2,
            y: face.y + sortedEyes[1].y + sortedEyes[1].height / 2,
          });
          
          // Estimate nose position (between eyes, lower)
          const noseX = (landmarks[0].x + landmarks[1].x) / 2;
          const noseY = landmarks[0].y + (face.height * 0.3);
          landmarks.push({ x: noseX, y: noseY });
          
          // Estimate mouth position
          const mouthX = noseX;
          const mouthY = face.y + (face.height * 0.75);
          landmarks.push({ x: mouthX, y: mouthY });
        }

        results.push({
          boundingBox: face,
          landmarks,
          confidence: 0.8, // Basic confidence score
        });
      }

      return results;
      
    } catch (error) {
      logger.error('Face detection failed:', error);
      throw new Error('Face detection failed');
    }
  }

  /**
   * Resize image with options
   */
  static resizeImage(image: cv.Mat, options: ImageProcessingOptions): cv.Mat {
    try {
      const { targetWidth, targetHeight, maintainAspectRatio = true, interpolation = cv.INTER_LINEAR } = options;
      
      if (!targetWidth && !targetHeight) {
        return image.clone();
      }

      let newWidth = targetWidth || image.cols;
      let newHeight = targetHeight || image.rows;

      if (maintainAspectRatio && targetWidth && targetHeight) {
        const aspectRatio = image.cols / image.rows;
        const targetAspectRatio = targetWidth / targetHeight;

        if (aspectRatio > targetAspectRatio) {
          // Image is wider than target
          newHeight = Math.round(targetWidth / aspectRatio);
          newWidth = targetWidth;
        } else {
          // Image is taller than target
          newWidth = Math.round(targetHeight * aspectRatio);
          newHeight = targetHeight;
        }
      }

      return image.resize(newHeight, newWidth, 0, 0, interpolation);
      
    } catch (error) {
      logger.error('Image resize failed:', error);
      throw new Error('Image resize failed');
    }
  }

  /**
   * Normalize image for neural network input
   */
  static normalizeForML(image: cv.Mat, targetSize: { width: number; height: number }): Float32Array {
    try {
      // Resize to target size
      const resized = image.resize(targetSize.height, targetSize.width);
      
      // Convert to RGB if needed
      const rgb = resized.channels === 3 ? resized.cvtColor(cv.COLOR_BGR2RGB) : resized;
      
      // Convert to float32 and normalize to [0, 1]
      const normalized = rgb.convertTo(cv.CV_32F, 1.0 / 255.0);
      
      // Convert to flat array (CHW format for most models)
      const data = new Float32Array(targetSize.width * targetSize.height * 3);
      
      for (let c = 0; c < 3; c++) {
        for (let y = 0; y < targetSize.height; y++) {
          for (let x = 0; x < targetSize.width; x++) {
            const pixelValue = normalized.at(y, x);
            const channelValue = Array.isArray(pixelValue) ? pixelValue[c] : pixelValue;
            data[c * targetSize.width * targetSize.height + y * targetSize.width + x] = channelValue;
          }
        }
      }
      
      return data;
      
    } catch (error) {
      logger.error('Image normalization failed:', error);
      throw new Error('Image normalization failed');
    }
  }

  /**
   * Denormalize neural network output back to image
   */
  static denormalizeFromML(data: Float32Array, dimensions: { width: number; height: number; channels: number }): cv.Mat {
    try {
      const { width, height, channels } = dimensions;
      
      // Create Mat from normalized data
      const mat = cv.Mat.zeros(height, width, cv.CV_32FC3);
      
      // Convert from CHW to HWC format and denormalize
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixel = [];
          for (let c = 0; c < channels; c++) {
            const value = data[c * width * height + y * width + x];
            pixel.push(Math.max(0, Math.min(255, value * 255))); // Clamp and denormalize
          }
          mat.set(y, x, pixel);
        }
      }
      
      // Convert back to 8-bit
      return mat.convertTo(cv.CV_8UC3);
      
    } catch (error) {
      logger.error('Image denormalization failed:', error);
      throw new Error('Image denormalization failed');
    }
  }

  /**
   * Apply Gaussian blur
   */
  static applyGaussianBlur(image: cv.Mat, kernelSize: number = 5, sigma: number = 1.0): cv.Mat {
    try {
      return image.gaussianBlur(new cv.Size(kernelSize, kernelSize), sigma, sigma);
    } catch (error) {
      logger.error('Gaussian blur failed:', error);
      throw new Error('Gaussian blur failed');
    }
  }

  /**
   * Adjust brightness and contrast
   */
  static adjustBrightnessContrast(image: cv.Mat, alpha: number = 1.0, beta: number = 0): cv.Mat {
    try {
      return image.convertTo(cv.CV_8U, alpha, beta);
    } catch (error) {
      logger.error('Brightness/contrast adjustment failed:', error);
      throw new Error('Brightness/contrast adjustment failed');
    }
  }

  /**
   * Create face mask from landmarks
   */
  static createFaceMask(image: cv.Mat, landmarks: FacialLandmark[]): cv.Mat {
    try {
      const mask = cv.Mat.zeros(image.rows, image.cols, cv.CV_8UC1);
      
      if (landmarks.length >= 4) {
        // Create a simple elliptical mask based on eye and mouth positions
        const leftEye = landmarks[0];
        const rightEye = landmarks[1];
        const nose = landmarks[2];
        const mouth = landmarks[3];
        
        // Calculate face center and dimensions
        const centerX = (leftEye.x + rightEye.x) / 2;
        const centerY = (nose.y + mouth.y) / 2;
        
        const faceWidth = Math.abs(rightEye.x - leftEye.x) * 2.5;
        const faceHeight = Math.abs(mouth.y - leftEye.y) * 1.8;
        
        // Draw elliptical mask
        cv.ellipse(
          mask,
          new cv.Point(centerX, centerY),
          new cv.Size(faceWidth / 2, faceHeight / 2),
          0, 0, 360,
          new cv.Vec([255]),
          -1
        );
      }
      
      return mask;
      
    } catch (error) {
      logger.error('Face mask creation failed:', error);
      throw new Error('Face mask creation failed');
    }
  }

  /**
   * Blend two images using a mask
   */
  static blendImages(foreground: cv.Mat, background: cv.Mat, mask: cv.Mat, alpha: number = 1.0): cv.Mat {
    try {
      // Ensure all images have the same size
      const targetSize = new cv.Size(background.cols, background.rows);
      const resizedForeground = foreground.resize(targetSize.height, targetSize.width);
      const resizedMask = mask.resize(targetSize.height, targetSize.width);
      
      // Normalize mask to [0, 1]
      const normalizedMask = resizedMask.convertTo(cv.CV_32F, 1.0 / 255.0);
      
      // Convert images to float for blending
      const fgFloat = resizedForeground.convertTo(cv.CV_32F);
      const bgFloat = background.convertTo(cv.CV_32F);
      
      // Blend: result = background * (1 - mask) + foreground * mask * alpha
      const result = cv.Mat.zeros(background.rows, background.cols, cv.CV_32FC3);
      
      for (let y = 0; y < result.rows; y++) {
        for (let x = 0; x < result.cols; x++) {
          const maskValue = normalizedMask.at(y, x) as number * alpha;
          const fgPixel = fgFloat.at(y, x) as number[];
          const bgPixel = bgFloat.at(y, x) as number[];
          
          const blendedPixel = [
            bgPixel[0] * (1 - maskValue) + fgPixel[0] * maskValue,
            bgPixel[1] * (1 - maskValue) + fgPixel[1] * maskValue,
            bgPixel[2] * (1 - maskValue) + fgPixel[2] * maskValue,
          ];
          
          result.set(y, x, blendedPixel);
        }
      }
      
      return result.convertTo(cv.CV_8UC3);
      
    } catch (error) {
      logger.error('Image blending failed:', error);
      throw new Error('Image blending failed');
    }
  }
}

// Initialize OpenCV on module load
OpenCVUtils.initialize().catch((error) => {
  logger.error('Failed to initialize OpenCV utils:', error);
});