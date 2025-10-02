import React, { useCallback, useState, useRef } from 'react';
import { useImageUpload } from '../hooks/useImageUpload';
import { uploadService } from '../services/uploadService';

interface FileUploadProps {
  onUploadComplete: (fileUrl: string, file: File) => void;
  onUploadError?: (error: string) => void;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  className?: string;
  children?: React.ReactNode;
}

export default function FileUpload({
  onUploadComplete,
  onUploadError,
  multiple = false,
  accept = 'image/jpeg,image/jpg,image/png,image/webp',
  maxFiles = 1,
  className = '',
  children
}: FileUploadProps) {
  const { uploadState, uploadFile, cancelUpload, resetUpload } = useImageUpload();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileValidation = useCallback((files: FileList | File[]): File[] => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Check file count
    if (fileArray.length > maxFiles) {
      const errorMessage = `Maximum ${maxFiles} file(s) allowed`;
      onUploadError?.(errorMessage);
      return [];
    }

    // Validate each file
    for (const file of fileArray) {
      const validation = uploadService.validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    // Report errors
    if (errors.length > 0) {
      const errorMessage = errors.join('; ');
      onUploadError?.(errorMessage);
      return [];
    }

    return validFiles;
  }, [maxFiles, onUploadError]);

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setSelectedFiles(files);

    try {
      if (multiple) {
        // Upload multiple files
        const uploadPromises = files.map(file => uploadFile(file));
        const results = await Promise.all(uploadPromises);
        
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const file = files[i];
          
          if (result && file) {
            if (result.success && result.fileUrl) {
              onUploadComplete(result.fileUrl, file);
            } else {
              onUploadError?.(result.error || 'Upload failed');
            }
          }
        }
      } else {
        // Upload single file
        const firstFile = files[0];
        if (firstFile) {
          const result = await uploadFile(firstFile);
          
          if (result && result.success && result.fileUrl) {
            onUploadComplete(result.fileUrl, firstFile);
          } else {
            onUploadError?.(result?.error || 'Upload failed');
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      onUploadError?.(errorMessage);
    } finally {
      setSelectedFiles([]);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [uploadFile, multiple, onUploadComplete, onUploadError]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles = handleFileValidation(files);
    if (validFiles.length > 0) {
      handleFileUpload(validFiles);
    }
  }, [handleFileValidation, handleFileUpload]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Only set drag over to false if we're leaving the drop zone entirely
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    const validFiles = handleFileValidation(files);
    if (validFiles.length > 0) {
      handleFileUpload(validFiles);
    }
  }, [handleFileValidation, handleFileUpload]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCancel = useCallback(() => {
    cancelUpload();
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [cancelUpload]);

  const handleReset = useCallback(() => {
    resetUpload();
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [resetUpload]);

  const isUploading = uploadState.isUploading;
  const progress = uploadState.progress;
  const error = uploadState.error;

  return (
    <div className={`file-upload ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="File upload input"
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragOver 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : ''}
        `}
      >
        {children ? (
          children
        ) : (
          <div className="space-y-4">
            {/* Upload icon */}
            <div className="mx-auto w-12 h-12 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            {/* Upload text */}
            <div>
              <p className="text-lg font-medium text-gray-900">
                {isUploading ? 'Uploading...' : 'Drop files here or click to browse'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {multiple 
                  ? `Upload up to ${maxFiles} image files (JPEG, PNG, WebP, max 10MB each)`
                  : 'Upload an image file (JPEG, PNG, WebP, max 10MB)'
                }
              </p>
            </div>

            {/* Selected files */}
            {selectedFiles.length > 0 && (
              <div className="text-sm text-gray-600">
                <p className="font-medium">Selected files:</p>
                <ul className="mt-1 space-y-1">
                  {selectedFiles.map((file, index) => (
                    <li key={index} className="flex items-center justify-between">
                      <span>{file.name}</span>
                      <span className="text-gray-400">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
              <p className="text-sm font-medium text-gray-900">
                Uploading... {progress?.percentage || 0}%
              </p>
              {progress && (
                <div className="w-48 bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                    role="progressbar"
                    aria-valuenow={progress.percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  ></div>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <div className="flex items-center justify-between">
            <p className="text-sm">{error}</p>
            <button
              onClick={handleReset}
              className="text-xs text-red-600 hover:text-red-800 underline ml-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Upload success message */}
      {uploadState.result?.success && (
        <div className="mt-3 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          <p className="text-sm">Upload completed successfully!</p>
        </div>
      )}
    </div>
  );
}