import { useState, useCallback, useRef } from 'react';
import { uploadService, UploadProgress, UploadResult, UploadOptions } from '../services/uploadService';

export interface UploadState {
  isUploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  result: UploadResult | null;
}

export interface UseImageUploadReturn {
  uploadState: UploadState;
  uploadFile: (file: File, options?: UploadOptions) => Promise<UploadResult>;
  uploadBlob: (blob: Blob, fileName?: string, options?: UploadOptions) => Promise<UploadResult>;
  cancelUpload: () => void;
  resetUpload: () => void;
}

/**
 * React hook for image upload functionality
 * Provides state management and integration with the upload service
 */
export function useImageUpload(): UseImageUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: null,
    error: null,
    result: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const resetUpload = useCallback(() => {
    setUploadState({
      isUploading: false,
      progress: null,
      error: null,
      result: null,
    });
  }, []);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploadState(prev => ({
      ...prev,
      isUploading: false,
      error: 'Upload cancelled',
    }));
  }, []);

  const uploadFile = useCallback(async (
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    // Reset previous state
    setUploadState({
      isUploading: true,
      progress: null,
      error: null,
      result: null,
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const result = await uploadService.uploadFile(file, {
        ...options,
        signal: abortControllerRef.current.signal,
        onProgress: (progress) => {
          setUploadState(prev => ({
            ...prev,
            progress,
          }));
          options.onProgress?.(progress);
        },
      });

      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        result,
        error: result.success ? null : result.error || 'Upload failed',
      }));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: errorMessage,
      }));

      return {
        success: false,
        error: errorMessage,
        uploadId: `error_${Date.now()}`,
      };
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const uploadBlob = useCallback(async (
    blob: Blob,
    fileName: string = 'capture.jpg',
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    const file = uploadService.createFileFromBlob(blob, fileName);
    return uploadFile(file, options);
  }, [uploadFile]);

  return {
    uploadState,
    uploadFile,
    uploadBlob,
    cancelUpload,
    resetUpload,
  };
}

/**
 * Hook for uploading camera captures specifically
 * Provides additional utilities for camera-captured images
 */
export function useCameraUpload() {
  const imageUpload = useImageUpload();

  const uploadCameraCapture = useCallback(async (
    blob: Blob,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `camera-capture-${timestamp}.jpg`;
    
    return imageUpload.uploadBlob(blob, fileName, options);
  }, [imageUpload]);

  return {
    ...imageUpload,
    uploadCameraCapture,
  };
}