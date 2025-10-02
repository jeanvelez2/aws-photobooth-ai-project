import React, { useState } from 'react';
import CameraCaptureWithUpload from '../components/CameraCaptureWithUpload';
import FileUpload from '../components/FileUpload';
import type { CapturedPhoto } from '../types';

/**
 * Example component showing how to use the upload functionality
 * This demonstrates both camera capture with upload and file upload components
 */
export default function UploadExample() {
  const [uploadedImages, setUploadedImages] = useState<Array<{
    url: string;
    name: string;
    source: 'camera' | 'file';
  }>>([]);
  const [currentPhoto, setCurrentPhoto] = useState<CapturedPhoto | null>(null);

  const handlePhotoCapture = (photo: CapturedPhoto) => {
    console.log('Photo captured:', photo);
    setCurrentPhoto(photo);
  };

  const handlePhotoUploaded = (photoUrl: string, photo: CapturedPhoto) => {
    console.log('Photo uploaded:', photoUrl);
    setUploadedImages(prev => [...prev, {
      url: photoUrl,
      name: `Camera capture ${new Date().toLocaleTimeString()}`,
      source: 'camera'
    }]);
  };

  const handleFileUploadComplete = (fileUrl: string, file: File) => {
    console.log('File uploaded:', fileUrl, file);
    setUploadedImages(prev => [...prev, {
      url: fileUrl,
      name: file.name,
      source: 'file'
    }]);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    alert(`Upload error: ${error}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-center">Upload Functionality Demo</h1>
      
      {/* Camera Capture with Auto-Upload */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Camera Capture with Auto-Upload</h2>
        <p className="text-gray-600">
          Take a photo and it will automatically upload to the server.
        </p>
        <CameraCaptureWithUpload
          onPhotoCapture={handlePhotoCapture}
          onPhotoUploaded={handlePhotoUploaded}
          autoUpload={true}
          className="max-w-2xl mx-auto"
        />
      </section>

      {/* Manual Camera Capture */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Camera Capture with Manual Upload</h2>
        <p className="text-gray-600">
          Take a photo and manually upload it using the upload button.
        </p>
        <CameraCaptureWithUpload
          onPhotoCapture={handlePhotoCapture}
          onPhotoUploaded={handlePhotoUploaded}
          autoUpload={false}
          className="max-w-2xl mx-auto"
        />
      </section>

      {/* File Upload */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">File Upload</h2>
        <p className="text-gray-600">
          Drag and drop files or click to browse and upload images.
        </p>
        <FileUpload
          onUploadComplete={handleFileUploadComplete}
          onUploadError={handleUploadError}
          className="max-w-2xl mx-auto"
        />
      </section>

      {/* Multiple File Upload */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Multiple File Upload</h2>
        <p className="text-gray-600">
          Upload up to 3 files at once.
        </p>
        <FileUpload
          onUploadComplete={handleFileUploadComplete}
          onUploadError={handleUploadError}
          multiple={true}
          maxFiles={3}
          className="max-w-2xl mx-auto"
        />
      </section>

      {/* Current Photo Preview */}
      {currentPhoto && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Current Photo</h2>
          <div className="max-w-md mx-auto">
            <img
              src={currentPhoto.dataUrl}
              alt="Current capture"
              className="w-full rounded-lg shadow-lg"
            />
            <p className="text-sm text-gray-600 mt-2">
              Captured: {currentPhoto.timestamp.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">
              Size: {currentPhoto.dimensions.width} × {currentPhoto.dimensions.height}
            </p>
          </div>
        </section>
      )}

      {/* Uploaded Images Gallery */}
      {uploadedImages.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Uploaded Images</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedImages.map((image, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-4">
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-48 object-cover rounded-lg mb-2"
                  onError={(e) => {
                    // Fallback for broken images
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4=';
                  }}
                />
                <h3 className="font-medium text-sm truncate">{image.name}</h3>
                <p className="text-xs text-gray-500 capitalize">
                  Source: {image.source}
                </p>
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  View Full Size
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Usage Instructions */}
      <section className="bg-gray-50 rounded-lg p-6 space-y-4">
        <h2 className="text-2xl font-semibold">Usage Instructions</h2>
        <div className="space-y-2 text-sm text-gray-700">
          <p><strong>Camera Capture:</strong> Click "Enable Camera" to start, then click the capture button to take a photo.</p>
          <p><strong>Auto-Upload:</strong> Photos are automatically uploaded after capture.</p>
          <p><strong>Manual Upload:</strong> Use the "Upload Photo" button to upload captured photos.</p>
          <p><strong>File Upload:</strong> Drag files onto the upload area or click to browse.</p>
          <p><strong>Supported Formats:</strong> JPEG, PNG, WebP (max 10MB each)</p>
          <p><strong>Progress Tracking:</strong> Upload progress is shown with a progress bar.</p>
          <p><strong>Error Handling:</strong> Validation errors and upload failures are displayed with retry options.</p>
        </div>
      </section>
    </div>
  );
}