import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageUploadService, UploadError } from './uploadService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  public readyState = 0;
  public status = 0;
  public statusText = '';
  public response = '';
  public upload = {
    addEventListener: vi.fn(),
  };
  
  private listeners: { [key: string]: Function[] } = {};
  
  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn();
  
  // Helper methods for testing
  triggerEvent(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
  
  simulateSuccess() {
    this.status = 200;
    this.triggerEvent('load');
  }
  
  simulateError() {
    this.triggerEvent('error');
  }
  
  simulateTimeout() {
    this.triggerEvent('timeout');
  }
  
  simulateProgress(loaded: number, total: number) {
    this.upload.addEventListener.mock.calls.forEach(([event, callback]) => {
      if (event === 'progress') {
        callback({ lengthComputable: true, loaded, total });
      }
    });
  }
}

// Mock XMLHttpRequest globally
global.XMLHttpRequest = MockXMLHttpRequest as any;

describe('ImageUploadService', () => {
  let uploadService: ImageUploadService;
  let mockFile: File;

  beforeEach(() => {
    uploadService = new ImageUploadService('/api');
    mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateFile', () => {
    it('should validate a valid JPEG file', () => {
      const result = uploadService.validateFile(mockFile);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject files with invalid type', () => {
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = uploadService.validateFile(invalidFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should reject files that are too large', () => {
      // Create a file larger than 10MB
      const largeContent = new Array(11 * 1024 * 1024).fill('x').join('');
      const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      
      const result = uploadService.validateFile(largeFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File size exceeds');
    });

    it('should reject empty files', () => {
      const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
      const result = uploadService.validateFile(emptyFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('File is empty');
    });

    it('should accept PNG files', () => {
      const pngFile = new File(['png content'], 'test.png', { type: 'image/png' });
      const result = uploadService.validateFile(pngFile);
      expect(result.isValid).toBe(true);
    });

    it('should accept WebP files', () => {
      const webpFile = new File(['webp content'], 'test.webp', { type: 'image/webp' });
      const result = uploadService.validateFile(webpFile);
      expect(result.isValid).toBe(true);
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      // Mock successful presigned URL response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          uploadUrl: 'https://s3.amazonaws.com/bucket/upload-url',
          fileUrl: 'https://s3.amazonaws.com/bucket/file-url'
        })
      });
    });

    it('should successfully upload a valid file', async () => {
      const mockXhr = new MockXMLHttpRequest();
      vi.spyOn(global, 'XMLHttpRequest').mockImplementation(() => mockXhr);

      const uploadPromise = uploadService.uploadFile(mockFile);
      
      // Simulate successful upload
      setTimeout(() => mockXhr.simulateSuccess(), 0);
      
      const result = await uploadPromise;
      
      expect(result.success).toBe(true);
      expect(result.fileUrl).toBe('https://s3.amazonaws.com/bucket/file-url');
      expect(result.error).toBeUndefined();
    });

    it('should handle presigned URL fetch errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' })
      });

      const result = await uploadService.uploadFile(mockFile, {
        maxRetries: 0, // No retries for faster test
        retryDelay: 1
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Server error');
    });

    it('should handle S3 upload errors', async () => {
      const mockXhr = new MockXMLHttpRequest();
      vi.spyOn(global, 'XMLHttpRequest').mockImplementation(() => mockXhr);

      const uploadPromise = uploadService.uploadFile(mockFile, {
        maxRetries: 0, // No retries for faster test
        retryDelay: 1
      });
      
      // Simulate upload error
      setTimeout(() => mockXhr.simulateError(), 0);
      
      const result = await uploadPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle upload timeout', async () => {
      const mockXhr = new MockXMLHttpRequest();
      vi.spyOn(global, 'XMLHttpRequest').mockImplementation(() => mockXhr);

      const uploadPromise = uploadService.uploadFile(mockFile, {
        maxRetries: 0, // No retries for faster test
        retryDelay: 1
      });
      
      // Simulate timeout
      setTimeout(() => mockXhr.simulateTimeout(), 0);
      
      const result = await uploadPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload timeout');
    });

    it('should track upload progress', async () => {
      const mockXhr = new MockXMLHttpRequest();
      vi.spyOn(global, 'XMLHttpRequest').mockImplementation(() => mockXhr);

      const progressCallback = vi.fn();
      const uploadPromise = uploadService.uploadFile(mockFile, {
        onProgress: progressCallback
      });
      
      // Simulate progress events
      setTimeout(() => {
        mockXhr.simulateProgress(50, 100);
        mockXhr.simulateProgress(100, 100);
        mockXhr.simulateSuccess();
      }, 0);
      
      await uploadPromise;
      
      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 50,
        total: 100,
        percentage: 50
      });
      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 100,
        total: 100,
        percentage: 100
      });
    });

    it('should handle upload cancellation', async () => {
      const mockXhr = new MockXMLHttpRequest();
      vi.spyOn(global, 'XMLHttpRequest').mockImplementation(() => mockXhr);

      const abortController = new AbortController();
      const uploadPromise = uploadService.uploadFile(mockFile, {
        signal: abortController.signal
      });
      
      // Cancel the upload
      setTimeout(() => abortController.abort(), 0);
      
      const result = await uploadPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload cancelled');
      expect(mockXhr.abort).toHaveBeenCalled();
    });

    it('should retry failed uploads', async () => {
      let attemptCount = 0;
      
      // Mock fetch to fail first two times, then succeed
      mockFetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'Server error' })
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              uploadUrl: 'https://s3.amazonaws.com/bucket/upload-url',
              fileUrl: 'https://s3.amazonaws.com/bucket/file-url'
            })
          });
        }
      });

      const mockXhr = new MockXMLHttpRequest();
      vi.spyOn(global, 'XMLHttpRequest').mockImplementation(() => mockXhr);

      const uploadPromise = uploadService.uploadFile(mockFile, {
        maxRetries: 2,
        retryDelay: 1 // Very short delay for testing
      });
      
      // Simulate successful upload on the third attempt
      setTimeout(() => mockXhr.simulateSuccess(), 10);
      
      const result = await uploadPromise;
      
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400, // Client error - not retryable
        json: () => Promise.resolve({ message: 'Bad request' })
      });

      const result = await uploadService.uploadFile(mockFile, {
        maxRetries: 2
      });
      
      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries for client errors
    });

    it('should validate file before upload', async () => {
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      const result = await uploadService.uploadFile(invalidFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
      expect(mockFetch).not.toHaveBeenCalled(); // Should not attempt upload
    });
  });

  describe('createFileFromBlob', () => {
    it('should create a File from a Blob', () => {
      const blob = new Blob(['test content'], { type: 'image/jpeg' });
      const file = uploadService.createFileFromBlob(blob, 'test.jpg');
      
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('test.jpg');
      expect(file.type).toBe('image/jpeg');
    });

    it('should use default filename if not provided', () => {
      const blob = new Blob(['test content'], { type: 'image/jpeg' });
      const file = uploadService.createFileFromBlob(blob);
      
      expect(file.name).toBe('capture.jpg');
    });

    it('should use default type if blob has no type', () => {
      const blob = new Blob(['test content']);
      const file = uploadService.createFileFromBlob(blob);
      
      expect(file.type).toBe('image/jpeg');
    });
  });

  describe('uploadFiles', () => {
    it('should upload multiple files concurrently', async () => {
      const file1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });
      
      // Reset mock fetch for clean state
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          uploadUrl: 'https://s3.amazonaws.com/bucket/upload-url',
          fileUrl: 'https://s3.amazonaws.com/bucket/file-url'
        })
      });

      const mockXhr1 = new MockXMLHttpRequest();
      const mockXhr2 = new MockXMLHttpRequest();
      let xhrCount = 0;
      
      vi.spyOn(global, 'XMLHttpRequest').mockImplementation(() => {
        return xhrCount++ === 0 ? mockXhr1 : mockXhr2;
      });

      const uploadPromise = uploadService.uploadFiles([file1, file2]);
      
      // Simulate successful uploads
      setTimeout(() => {
        mockXhr1.simulateSuccess();
        mockXhr2.simulateSuccess();
      }, 0);
      
      const results = await uploadPromise;
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('UploadError', () => {
    it('should create error with correct properties', () => {
      const error = new UploadError('Test error', 'TEST_CODE', true);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('UploadError');
    });

    it('should default retryable to false', () => {
      const error = new UploadError('Test error', 'TEST_CODE');
      
      expect(error.retryable).toBe(false);
    });
  });
});