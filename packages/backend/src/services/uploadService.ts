import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

import { config } from '../config/index.js';

export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    this.bucketName = config.aws.s3.bucketName;
    
    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is required');
    }
  }

  async generatePresignedUploadUrl(fileType: string, userId?: string): Promise<{
    uploadUrl: string;
    key: string;
    photoId: string;
  }> {
    const photoId = uuidv4();
    const key = `uploads/${userId || 'anonymous'}/${photoId}.${this.getFileExtension(fileType)}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType,
      Metadata: {
        uploadedAt: new Date().toISOString(),
        userId: userId || 'anonymous',
      },
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });

    logger.info('Generated presigned upload URL', { photoId, key, userId });

    return { uploadUrl, key, photoId };
  }

  async generatePresignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return extensions[mimeType] || 'jpg';
  }

  validateImageFile(file: { size: number; type: string }): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (file.size > maxSize) {
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' };
    }

    return { valid: true };
  }
}

export const uploadService = new UploadService();