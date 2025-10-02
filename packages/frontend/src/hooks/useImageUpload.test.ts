import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageUpload, useCameraUpload } from './useImageUpload';
import * as uploadServiceModule from '../services/uploadService';

// Mock the upload service
vi.mock('../services/uploadService', () => ({
  uploadService: {
    uploadFile: vi.fn(),
    createFileFromBlob: vi.fn(),
  },
}));

describe('useImageUpload', () => {
  const mockUploadService = uploadServiceModule.uploadService as any;
  let mockFile: File;
  let mockBlob: Blob;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
    mockBlob = new Blob(['test content'], { type: 'image/jpeg' });
  });

  describe('useImageUpload', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useImageUpload());

      expect(result.current.uploadState).toEqual({
        isUploading: false,
        progress: null,
        error: null,
        result: null,
      });
    });

    it('should handle successful file upload', async () => {
      const mockResult = {
        success: true,
        fileUrl: 'https://example.com/uploaded-file.jpg',
        uploadId: 'upload123',
      };

      mockUploadService.uploadFile.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useImageUpload());

      await act(async () => {
        const uploadResult = await result.current.uploadFile(mockFile);
        expect(uploadResult).toEqual(mockResult);
      });

      expect(result.current.uploadState.isUploading).toBe(false);
      expect(result.current.uploadState.result).toEqual(mockResult);
      expect(result.current.uploadState.error).toBeNull();
    });

    it('should handle upload failure', async () => {
      const mockResult = {
        success: false,
        error: 'Upload failed',
        uploadId: 'upload123',
      };

      mockUploadService.uploadFile.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useImageUpload());

      await act(async () => {
        const uploadResult = await result.current.uploadFile(mockFile);
        expect(uploadResult).toEqual(mockResult);
      });

      expect(result.current.uploadState.isUploading).toBe(false);
      expect(result.current.uploadState.result).toEqual(mockResult);
      expect(result.current.uploadState.error).toBe('Upload failed');
    });

    it('should track upload progress', async () => {
      const mockProgress = { loaded: 50, total: 100, percentage: 50 };
      
      mockUploadService.uploadFile.mockImplementation(async (file, options) => {
        // Simulate progress callback
        if (options?.onProgress) {
          setTimeout(() => options.onProgress(mockProgress), 0);
        }
        return {
          success: true,
          fileUrl: 'https://example.com/uploaded-file.jpg',
          uploadId: 'upload123',
        };
      });

      const { result } = renderHook(() => useImageUpload());

      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      // Progress should be updated during upload
      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        mockFile,
        expect.objectContaining({
          onProgress: expect.any(Function),
        })
      );
    });

    it('should handle upload cancellation', async () => {
      let abortController: AbortController;
      
      mockUploadService.uploadFile.mockImplementation(async (file, options) => {
        abortController = options?.signal?.constructor === AbortSignal ? 
          { abort: vi.fn() } as any : new AbortController();
        
        // Simulate cancellation
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const error = new Error('Upload cancelled');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      const { result } = renderHook(() => useImageUpload());

      act(() => {
        result.current.uploadFile(mockFile);
      });

      act(() => {
        result.current.cancelUpload();
      });

      expect(result.current.uploadState.isUploading).toBe(false);
      expect(result.current.uploadState.error).toBe('Upload cancelled');
    });

    it('should reset upload state', () => {
      const { result } = renderHook(() => useImageUpload());

      // Set some state
      act(() => {
        (result.current as any).uploadState = {
          isUploading: false,
          progress: { loaded: 100, total: 100, percentage: 100 },
          error: 'Some error',
          result: { success: false, error: 'Failed', uploadId: 'test' },
        };
      });

      act(() => {
        result.current.resetUpload();
      });

      expect(result.current.uploadState).toEqual({
        isUploading: false,
        progress: null,
        error: null,
        result: null,
      });
    });

    it('should upload blob as file', async () => {
      const mockFile = new File(['blob content'], 'blob.jpg', { type: 'image/jpeg' });
      const mockResult = {
        success: true,
        fileUrl: 'https://example.com/uploaded-blob.jpg',
        uploadId: 'upload123',
      };

      mockUploadService.createFileFromBlob.mockReturnValue(mockFile);
      mockUploadService.uploadFile.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useImageUpload());

      await act(async () => {
        const uploadResult = await result.current.uploadBlob(mockBlob, 'custom.jpg');
        expect(uploadResult).toEqual(mockResult);
      });

      expect(mockUploadService.createFileFromBlob).toHaveBeenCalledWith(mockBlob, 'custom.jpg');
      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        mockFile, 
        expect.objectContaining({
          onProgress: expect.any(Function),
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should use default filename for blob upload', async () => {
      const mockFile = new File(['blob content'], 'capture.jpg', { type: 'image/jpeg' });
      
      mockUploadService.createFileFromBlob.mockReturnValue(mockFile);
      mockUploadService.uploadFile.mockResolvedValue({
        success: true,
        fileUrl: 'https://example.com/uploaded-blob.jpg',
        uploadId: 'upload123',
      });

      const { result } = renderHook(() => useImageUpload());

      await act(async () => {
        await result.current.uploadBlob(mockBlob);
      });

      expect(mockUploadService.createFileFromBlob).toHaveBeenCalledWith(mockBlob, 'capture.jpg');
    });

    it('should handle upload service errors', async () => {
      const error = new Error('Service error');
      mockUploadService.uploadFile.mockRejectedValue(error);

      const { result } = renderHook(() => useImageUpload());

      await act(async () => {
        const uploadResult = await result.current.uploadFile(mockFile);
        expect(uploadResult.success).toBe(false);
        expect(uploadResult.error).toBe('Service error');
      });

      expect(result.current.uploadState.error).toBe('Service error');
    });
  });

  describe('useCameraUpload', () => {
    it('should upload camera capture with timestamp filename', async () => {
      const mockFile = new File(['camera content'], 'camera-capture.jpg', { type: 'image/jpeg' });
      const mockResult = {
        success: true,
        fileUrl: 'https://example.com/camera-capture.jpg',
        uploadId: 'upload123',
      };

      mockUploadService.createFileFromBlob.mockReturnValue(mockFile);
      mockUploadService.uploadFile.mockResolvedValue(mockResult);

      // Mock Date.toISOString to get predictable filename
      const mockDate = new Date('2023-01-01T12:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      vi.spyOn(mockDate, 'toISOString').mockReturnValue('2023-01-01T12-00-00-000Z');

      const { result } = renderHook(() => useCameraUpload());

      await act(async () => {
        const uploadResult = await result.current.uploadCameraCapture(mockBlob);
        expect(uploadResult).toEqual(mockResult);
      });

      expect(mockUploadService.createFileFromBlob).toHaveBeenCalledWith(
        mockBlob,
        'camera-capture-2023-01-01T12-00-00-000Z.jpg'
      );

      vi.restoreAllMocks();
    });

    it('should inherit all useImageUpload functionality', () => {
      const { result } = renderHook(() => useCameraUpload());

      // Should have all the same methods as useImageUpload
      expect(result.current.uploadState).toBeDefined();
      expect(result.current.uploadFile).toBeDefined();
      expect(result.current.uploadBlob).toBeDefined();
      expect(result.current.cancelUpload).toBeDefined();
      expect(result.current.resetUpload).toBeDefined();
      expect(result.current.uploadCameraCapture).toBeDefined();
    });
  });

  describe('error scenarios', () => {
    it('should handle non-Error exceptions', async () => {
      mockUploadService.uploadFile.mockRejectedValue('String error');

      const { result } = renderHook(() => useImageUpload());

      await act(async () => {
        const uploadResult = await result.current.uploadFile(mockFile);
        expect(uploadResult.success).toBe(false);
        expect(uploadResult.error).toBe('Upload failed');
      });
    });

    it('should handle undefined error', async () => {
      mockUploadService.uploadFile.mockRejectedValue(undefined);

      const { result } = renderHook(() => useImageUpload());

      await act(async () => {
        const uploadResult = await result.current.uploadFile(mockFile);
        expect(uploadResult.success).toBe(false);
        expect(uploadResult.error).toBe('Upload failed');
      });
    });
  });
});