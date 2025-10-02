/**
 * Image Upload Service
 * Handles file uploads using pre-signed URLs with validation, progress tracking, and retry logic
 */

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  maxRetries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
}

export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
  uploadId: string;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export class ImageUploadService {
  private readonly API_BASE_URL: string;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly DEFAULT_RETRY_DELAY = 1000; // 1 second

  constructor(apiBaseUrl?: string) {
    // Use environment variable or default to relative path
    this.API_BASE_URL = apiBaseUrl || import.meta.env.VITE_API_URL || '/api';
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): FileValidationResult {
    // Check file type
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed types: ${this.ALLOWED_TYPES.join(', ')}`
      };
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      const maxSizeMB = this.MAX_FILE_SIZE / (1024 * 1024);
      return {
        isValid: false,
        error: `File size exceeds ${maxSizeMB}MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'File is empty'
      };
    }

    return { isValid: true };
  }

  /**
   * Get pre-signed URL for upload
   */
  private async getPresignedUrl(fileName: string, fileType: string): Promise<{ uploadUrl: string; fileUrl: string }> {
    const response = await fetch(`${this.API_BASE_URL}/upload/presigned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName, fileType }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new UploadError(
        errorData.message || `Failed to get upload URL: ${response.status}`,
        'PRESIGNED_URL_ERROR',
        response.status >= 500 // Retry on server errors
      );
    }

    return response.json();
  }

  /**
   * Upload file to S3 using pre-signed URL
   */
  private async uploadToS3(
    uploadUrl: string,
    file: File,
    options: UploadOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Set up progress tracking
      if (options.onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            };
            options.onProgress!(progress);
          }
        });
      }

      // Set up abort signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new UploadError('Upload cancelled', 'UPLOAD_CANCELLED'));
        });
      }

      // Handle response
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new UploadError(
            `Upload failed with status ${xhr.status}`,
            'UPLOAD_FAILED',
            xhr.status >= 500 // Retry on server errors
          ));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new UploadError(
          'Network error during upload',
          'NETWORK_ERROR',
          true // Network errors are retryable
        ));
      });

      xhr.addEventListener('timeout', () => {
        reject(new UploadError(
          'Upload timeout',
          'UPLOAD_TIMEOUT',
          true // Timeouts are retryable
        ));
      });

      // Configure and send request
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.timeout = 60000; // 60 second timeout
      xhr.send(file);
    });
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Upload file with retry logic
   */
  async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const maxRetries = options.maxRetries ?? this.DEFAULT_MAX_RETRIES;
    const retryDelay = options.retryDelay ?? this.DEFAULT_RETRY_DELAY;

    // Validate file first
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
        uploadId
      };
    }

    let lastError: UploadError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 11);
        const extension = file.name.split('.').pop() || 'jpg';
        const fileName = `${timestamp}_${randomId}.${extension}`;

        // Get pre-signed URL
        const { uploadUrl, fileUrl } = await this.getPresignedUrl(fileName, file.type);

        // Upload file
        await this.uploadToS3(uploadUrl, file, options);

        return {
          success: true,
          fileUrl,
          uploadId
        };

      } catch (error) {
        lastError = error instanceof UploadError ? error : new UploadError(
          error instanceof Error ? error.message : 'Unknown upload error',
          'UNKNOWN_ERROR',
          false
        );

        console.warn(`Upload attempt ${attempt + 1} failed:`, lastError.message);

        // Don't retry if error is not retryable or if this was the last attempt
        if (!lastError.retryable || attempt === maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt);
          console.log(`Retrying upload in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Upload failed after all retry attempts',
      uploadId
    };
  }

  /**
   * Upload multiple files concurrently
   */
  async uploadFiles(
    files: File[],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, options));
    return Promise.all(uploadPromises);
  }

  /**
   * Create a File object from a Blob (useful for camera captures)
   */
  createFileFromBlob(blob: Blob, fileName: string = 'capture.jpg'): File {
    return new File([blob], fileName, {
      type: blob.type || 'image/jpeg',
      lastModified: Date.now()
    });
  }
}

// Export singleton instance
export const uploadService = new ImageUploadService();