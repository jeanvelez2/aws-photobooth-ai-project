/**
 * ImagePreview Component
 * Displays processed image results with download functionality and metadata
 */

import React, { useState, useCallback } from 'react';
import type { ProcessingResult, Theme } from '../types';

interface ImagePreviewProps {
  result: ProcessingResult;
  theme?: Theme | null;
  onDownload?: (customFilename?: string) => void;
  onRetry?: () => void;
  onStartOver?: () => void;
  className?: string;
}

interface DownloadOptions {
  filename: string;
  format: 'jpeg' | 'png';
  quality: number;
}

export default function ImagePreview({ 
  result, 
  theme, 
  onDownload, 
  onRetry, 
  onStartOver,
  className = '' 
}: ImagePreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions>({
    filename: `photobooth-${theme?.name?.toLowerCase() || 'result'}-${Date.now()}`,
    format: 'jpeg',
    quality: 95
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Handle image download
  const handleDownload = useCallback(async (customOptions?: Partial<DownloadOptions>) => {
    if (!result.resultUrl || isDownloading) return;

    setIsDownloading(true);
    
    try {
      const options = { ...downloadOptions, ...customOptions };
      
      // Fetch the image
      const response = await fetch(result.resultUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }
      
      const blob = await response.blob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${options.filename}.${options.format}`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(url);
      
      // Notify parent component
      onDownload?.(options.filename);
      
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download image. Please try again.');
    } finally {
      setIsDownloading(false);
      setShowDownloadOptions(false);
    }
  }, [result.resultUrl, downloadOptions, isDownloading, onDownload]);

  // Handle quick download (with default options)
  const handleQuickDownload = useCallback(() => {
    handleDownload();
  }, [handleDownload]);

  // Format processing time
  const formatProcessingTime = (timeMs?: number) => {
    if (!timeMs) return 'N/A';
    return `${Math.round(timeMs / 1000)}s`;
  };

  // Format file size (estimated)
  const getEstimatedFileSize = () => {
    // Rough estimate based on resolution and format
    const baseSize = 2400 * 3200 * 3; // RGB bytes
    const compressionRatio = downloadOptions.format === 'jpeg' ? 0.1 : 0.3;
    const sizeBytes = baseSize * compressionRatio;
    const sizeMB = sizeBytes / (1024 * 1024);
    return `~${sizeMB.toFixed(1)}MB`;
  };

  if (!result.resultUrl) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <div className="text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-medium">No image available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Image display */}
      <div className="relative">
        <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center">
          {!imageLoaded && !imageError && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading image...</p>
            </div>
          )}
          
          {imageError && (
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium">Failed to load image</p>
              <button 
                onClick={() => {
                  setImageError(false);
                  setImageLoaded(false);
                }}
                className="mt-2 text-purple-600 hover:text-purple-700"
              >
                Try again
              </button>
            </div>
          )}
          
          <img
            src={result.resultUrl}
            alt="Processed result"
            className={`w-full h-full object-cover ${imageLoaded ? 'block' : 'hidden'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </div>

        {/* Image overlay with metadata */}
        {imageLoaded && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm">
            2400×3200 • {downloadOptions.format.toUpperCase()}
          </div>
        )}
      </div>

      {/* Image info and controls */}
      <div className="p-6">
        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {theme?.name || 'Custom'}
            </div>
            <div className="text-sm text-gray-600">Theme</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">2400×3200</div>
            <div className="text-sm text-gray-600">Resolution</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {formatProcessingTime(result.processingTime)}
            </div>
            <div className="text-sm text-gray-600">Processing Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {getEstimatedFileSize()}
            </div>
            <div className="text-sm text-gray-600">File Size</div>
          </div>
        </div>

        {/* Download options (collapsible) */}
        {showDownloadOptions && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-900 mb-3">Download Options</h4>
            
            <div className="space-y-3">
              {/* Filename */}
              <div>
                <label htmlFor="filename-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Filename
                </label>
                <input
                  id="filename-input"
                  type="text"
                  value={downloadOptions.filename}
                  onChange={(e) => setDownloadOptions(prev => ({ ...prev, filename: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter filename"
                />
              </div>

              {/* Format */}
              <div>
                <label htmlFor="format-select" className="block text-sm font-medium text-gray-700 mb-1">
                  Format
                </label>
                <select
                  id="format-select"
                  value={downloadOptions.format}
                  onChange={(e) => setDownloadOptions(prev => ({ ...prev, format: e.target.value as 'jpeg' | 'png' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="jpeg">JPEG (smaller file size)</option>
                  <option value="png">PNG (lossless quality)</option>
                </select>
              </div>

              {/* Quality (for JPEG) */}
              {downloadOptions.format === 'jpeg' && (
                <div>
                  <label htmlFor="quality-range" className="block text-sm font-medium text-gray-700 mb-1">
                    Quality: {downloadOptions.quality}%
                  </label>
                  <input
                    id="quality-range"
                    type="range"
                    min="60"
                    max="100"
                    value={downloadOptions.quality}
                    onChange={(e) => setDownloadOptions(prev => ({ ...prev, quality: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Primary download button */}
          <button
            onClick={handleQuickDownload}
            disabled={isDownloading}
            data-testid="download-button"
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
          >
            {isDownloading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Downloading...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Image
              </>
            )}
          </button>

          {/* Download options toggle */}
          <button
            onClick={() => setShowDownloadOptions(!showDownloadOptions)}
            className="px-4 py-3 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </button>
        </div>

        {/* Secondary actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          {onRetry && (
            <button
              onClick={onRetry}
              data-testid="retry-button"
              className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Try Another Theme
            </button>
          )}
          
          {onStartOver && (
            <button
              onClick={onStartOver}
              data-testid="start-over-button"
              className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Start Over
            </button>
          )}
        </div>
      </div>
    </div>
  );
}