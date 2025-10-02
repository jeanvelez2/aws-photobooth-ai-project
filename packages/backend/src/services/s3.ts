import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3ClientPool } from './awsClientPool.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface S3UploadError extends Error {
  code: string;
  statusCode?: number;
}

export class S3Service {
  private readonly bucketName: string;
  private readonly maxSizeBytes: number;
  private readonly allowedTypes: string[];
  private readonly expiryMinutes: number;

  constructor() {
    this.bucketName = config.aws.s3.bucket;
    this.maxSizeBytes = config.upload.maxSizeMB * 1024 * 1024; // Convert MB to bytes
    this.allowedTypes = config.upload.allowedTypes;
    this.expiryMinutes = config.upload.presignedUrlExpiryMinutes;
  }

  /**
   * Validates file type and size for upload
   */
  validateFile(fileType: string, fileSize: number): void {
    // Validate file type
    if (!this.allowedTypes.includes(fileType)) {
      const error = new Error(
        `Invalid file type. Allowed types: ${this.allowedTypes.join(', ')}`
      ) as S3UploadError;
      error.code = 'INVALID_FILE_TYPE';
      error.statusCode = 400;
      throw error;
    }

    // Validate file size
    if (fileSize > this.maxSizeBytes) {
      const error = new Error(
        `File size exceeds maximum limit of ${config.upload.maxSizeMB}MB`
      ) as S3UploadError;
      error.code = 'FILE_TOO_LARGE';
      error.statusCode = 413;
      throw error;
    }

    // Validate file size is not zero
    if (fileSize <= 0) {
      const error = new Error('File size must be greater than 0') as S3UploadError;
      error.code = 'INVALID_FILE_SIZE';
      error.statusCode = 400;
      throw error;
    }
  }

  /**
   * Generates a unique S3 key for the uploaded file
   */
  generateS3Key(fileName: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const uuid = uuidv4();
    const parts = fileName.split('.');
    const extension = parts.length > 1 ? parts.pop() : 'jpg';
    return `uploads/${timestamp}/${uuid}.${extension}`;
  }

  /**
   * Generates a pre-signed URL for uploading files to S3
   */
  async generatePresignedUploadUrl(
    request: PresignedUrlRequest
  ): Promise<PresignedUrlResponse> {
    try {
      // Validate the file
      this.validateFile(request.fileType, request.fileSize);

      // Generate unique S3 key
      const key = this.generateS3Key(request.fileName);

      // Create the PutObject command
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: request.fileType,
        ContentLength: request.fileSize,
        Metadata: {
          originalFileName: request.fileName,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Generate the pre-signed URL using pooled client
      const expiresIn = this.expiryMinutes * 60; // Convert minutes to seconds
      const uploadUrl = await s3ClientPool.execute(async (client) => {
        return await getSignedUrl(client, command, { expiresIn });
      });

      logger.info('Pre-signed upload URL generated', {
        key,
        fileType: request.fileType,
        fileSize: request.fileSize,
        expiresIn,
      });

      return {
        uploadUrl,
        key,
        expiresIn,
      };
    } catch (error) {
      logger.error('Failed to generate pre-signed upload URL', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fileName: request.fileName,
        fileType: request.fileType,
        fileSize: request.fileSize,
      });

      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw validation errors
      }

      // Wrap AWS errors
      const s3Error = new Error('Failed to generate upload URL') as S3UploadError;
      s3Error.code = 'S3_OPERATION_FAILED';
      s3Error.statusCode = 500;
      throw s3Error;
    }
  }

  /**
   * Download a file from S3
   * @param bucket - The S3 bucket name
   * @param key - The S3 object key
   * @returns Promise<Buffer> - The file content as a buffer
   */
  async downloadFile(bucket: string, key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await s3ClientPool.execute(async (client) => {
        return await client.send(command);
      });
      
      if (!response.Body) {
        throw new Error('No file content received from S3');
      }

      // Convert the stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      
      logger.info('File downloaded successfully', { 
        bucket, 
        key,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to download file from S3', { 
        bucket, 
        key, 
        error: error instanceof Error ? error.message : error,
      });
      throw new Error('S3_DOWNLOAD_FAILED');
    }
  }

  /**
   * Upload a file directly to S3
   * @param key - The S3 object key
   * @param buffer - File content as buffer
   * @param contentType - MIME type of the file
   * @returns Promise<{url: string}> - The S3 URL of the uploaded file
   */
  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<{url: string}> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          uploadedAt: new Date().toISOString(),
        },
      });

      await s3ClientPool.execute(async (client) => {
        return await client.send(command);
      });
      
      const url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      
      logger.info('File uploaded successfully', { 
        bucket: this.bucketName, 
        key,
        size: buffer.length,
        url,
      });

      return { url };
    } catch (error) {
      logger.error('Failed to upload file to S3', { 
        bucket: this.bucketName, 
        key, 
        error: error instanceof Error ? error.message : error,
      });
      throw new Error('S3_UPLOAD_FAILED');
    }
  }

  /**
   * Generates a pre-signed URL for downloading files from S3
   */
  async generatePresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const downloadUrl = await s3ClientPool.execute(async (client) => {
        return await getSignedUrl(client, command, { expiresIn });
      });

      logger.info('Pre-signed download URL generated', {
        key,
        expiresIn,
      });

      return downloadUrl;
    } catch (error) {
      logger.error('Failed to generate pre-signed download URL', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });

      const s3Error = new Error('Failed to generate download URL') as S3UploadError;
      s3Error.code = 'S3_OPERATION_FAILED';
      s3Error.statusCode = 500;
      throw s3Error;
    }
  }
}

// Export singleton instance
export const s3Service = new S3Service();