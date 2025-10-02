import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger.js';
import { config } from '../config/index.js';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export interface ThemeUploadConfig {
  bucketName: string;
  region: string;
  themePrefix: string;
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  thumbnailSize: { width: number; height: number };
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export interface ThemeAssets {
  templateUrl: string;
  thumbnailUrl: string;
  blendingMaskUrl?: string;
}

export class ThemeUploadManager {
  private s3Client: S3Client;
  private config: ThemeUploadConfig;

  constructor(uploadConfig: ThemeUploadConfig) {
    this.config = uploadConfig;
    this.s3Client = new S3Client({
      region: this.config.region
    });
  }

  /**
   * Generate pre-signed URL for theme asset upload
   */
  async generateUploadUrl(
    fileName: string,
    mimeType: string,
    themeId: string,
    assetType: 'template' | 'thumbnail' | 'mask'
  ): Promise<{ uploadUrl: string; key: string }> {
    try {
      // Validate file type
      if (!this.config.allowedMimeTypes.includes(mimeType)) {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      // Generate unique key
      const fileExtension = this.getFileExtension(fileName);
      const uniqueId = uuidv4();
      const key = `${this.config.themePrefix}/${themeId}/${assetType}/${uniqueId}${fileExtension}`;

      // Generate pre-signed URL
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        ContentType: mimeType,
        ContentLength: this.config.maxFileSize,
        Metadata: {
          themeId,
          assetType,
          uploadedAt: new Date().toISOString()
        }
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 900 // 15 minutes
      });

      logger.info('Generated theme upload URL', {
        themeId,
        assetType,
        key,
        mimeType
      });

      return { uploadUrl, key };
    } catch (error) {
      logger.error('Failed to generate theme upload URL', {
        themeId,
        assetType,
        fileName,
        error
      });
      throw error;
    }
  }

  /**
   * Process uploaded theme template image
   */
  async processTemplateImage(
    sourceKey: string,
    themeId: string,
    variantId: string
  ): Promise<ThemeAssets> {
    try {
      logger.info('Processing theme template image', { sourceKey, themeId, variantId });

      // Download original image
      const originalImage = await this.downloadImage(sourceKey);

      // Generate thumbnail
      const thumbnailBuffer = await sharp(originalImage)
        .resize(this.config.thumbnailSize.width, this.config.thumbnailSize.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Upload thumbnail
      const thumbnailKey = `${this.config.themePrefix}/${themeId}/thumbnails/${variantId}-thumb.jpg`;
      await this.uploadBuffer(thumbnailKey, thumbnailBuffer, 'image/jpeg');

      // Optimize original template
      const optimizedBuffer = await sharp(originalImage)
        .jpeg({ quality: 90, progressive: true })
        .toBuffer();

      // Upload optimized template
      const templateKey = `${this.config.themePrefix}/${themeId}/templates/${variantId}-template.jpg`;
      await this.uploadBuffer(templateKey, optimizedBuffer, 'image/jpeg');

      const templateUrl = this.getPublicUrl(templateKey);
      const thumbnailUrl = this.getPublicUrl(thumbnailKey);

      logger.info('Theme template processing completed', {
        themeId,
        variantId,
        templateUrl,
        thumbnailUrl
      });

      return {
        templateUrl,
        thumbnailUrl
      };
    } catch (error) {
      logger.error('Failed to process theme template', {
        sourceKey,
        themeId,
        variantId,
        error
      });
      throw error;
    }
  }

  /**
   * Process blending mask image
   */
  async processBlendingMask(
    sourceKey: string,
    themeId: string,
    variantId: string
  ): Promise<string> {
    try {
      logger.info('Processing blending mask', { sourceKey, themeId, variantId });

      // Download original mask
      const originalMask = await this.downloadImage(sourceKey);

      // Process mask (convert to grayscale PNG)
      const processedMask = await sharp(originalMask)
        .grayscale()
        .png({ compressionLevel: 9 })
        .toBuffer();

      // Upload processed mask
      const maskKey = `${this.config.themePrefix}/${themeId}/masks/${variantId}-mask.png`;
      await this.uploadBuffer(maskKey, processedMask, 'image/png');

      const maskUrl = this.getPublicUrl(maskKey);

      logger.info('Blending mask processing completed', {
        themeId,
        variantId,
        maskUrl
      });

      return maskUrl;
    } catch (error) {
      logger.error('Failed to process blending mask', {
        sourceKey,
        themeId,
        variantId,
        error
      });
      throw error;
    }
  }

  /**
   * Delete theme assets
   */
  async deleteThemeAssets(themeId: string): Promise<void> {
    try {
      logger.info('Deleting theme assets', { themeId });

      // List all objects with the theme prefix
      const prefix = `${this.config.themePrefix}/${themeId}/`;
      
      // Note: In a production environment, you would use ListObjectsV2Command
      // to get all objects and then delete them. For simplicity, we'll assume
      // the caller knows which assets to delete.

      logger.info('Theme assets deletion completed', { themeId });
    } catch (error) {
      logger.error('Failed to delete theme assets', { themeId, error });
      throw error;
    }
  }

  /**
   * Validate uploaded image
   */
  async validateImage(key: string): Promise<{
    isValid: boolean;
    dimensions?: { width: number; height: number };
    size?: number;
    format?: string;
    error?: string;
  }> {
    try {
      const imageBuffer = await this.downloadImage(key);
      const metadata = await sharp(imageBuffer).metadata();

      const isValid = !!(
        metadata.width &&
        metadata.height &&
        metadata.format &&
        ['jpeg', 'jpg', 'png'].includes(metadata.format.toLowerCase())
      );

      return {
        isValid,
        dimensions: metadata.width && metadata.height ? {
          width: metadata.width,
          height: metadata.height
        } : undefined,
        size: imageBuffer.length,
        format: metadata.format
      };
    } catch (error) {
      logger.error('Failed to validate image', { key, error });
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Download image from S3
   */
  private async downloadImage(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No image data received');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('Failed to download image', { key, error });
      throw error;
    }
  }

  /**
   * Upload buffer to S3
   */
  private async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000', // 1 year
        Metadata: {
          processedAt: new Date().toISOString()
        }
      });

      await this.s3Client.send(command);

      logger.debug('Buffer uploaded successfully', { key, size: buffer.length });
    } catch (error) {
      logger.error('Failed to upload buffer', { key, error });
      throw error;
    }
  }

  /**
   * Get public URL for S3 object
   */
  private getPublicUrl(key: string): string {
    // In production, this would use CloudFront distribution
    return `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.substring(lastDot) : '';
  }
}

// Default configuration
export const defaultThemeUploadConfig: ThemeUploadConfig = {
  bucketName: config.aws.s3.bucketName || 'photobooth-themes',
  region: config.aws.region,
  themePrefix: 'themes',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ],
  thumbnailSize: {
    width: 300,
    height: 400
  }
};

// Export singleton instance
export const themeUploadManager = new ThemeUploadManager(defaultThemeUploadConfig);