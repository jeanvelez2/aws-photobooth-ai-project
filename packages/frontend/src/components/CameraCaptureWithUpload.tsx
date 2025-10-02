import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useCameraUpload } from '../hooks/useImageUpload';
import type { CapturedPhoto } from '../types';

interface CameraCaptureWithUploadProps {
  onPhotoCapture: (photo: CapturedPhoto) => void;
  onPhotoUploaded: (photoUrl: string, photo: CapturedPhoto) => void;
  autoUpload?: boolean;
  className?: string;
}

export default function CameraCaptureWithUpload({ 
  onPhotoCapture, 
  onPhotoUploaded,
  autoUpload = false,
  className = '' 
}: CameraCaptureWithUploadProps) {
  const { state, dispatch } = useAppContext();
  const { camera, ui } = state;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const isInitializedRef = useRef(false);

  // Upload functionality
  const { uploadState, uploadCameraCapture, cancelUpload, resetUpload } = useCameraUpload();

  // Get available camera devices
  const getDevices = async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      console.log('CameraCapture: Found devices:', videoDevices);
    } catch (error) {
      console.error('Error getting camera devices:', error);
      dispatch({ type: 'SET_CAMERA_ERROR', payload: 'Failed to get camera devices' });
    }
  };

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      console.log('CameraCapture: Starting camera with deviceId:', deviceId);
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_CAMERA_ERROR', payload: null });

      // Stop existing stream
      if (camera.stream) {
        camera.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }

      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      };

      if (deviceId) {
        videoConstraints.deviceId = { exact: deviceId };
      } else {
        videoConstraints.facingMode = { ideal: 'user' };
      }

      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('CameraCapture: Got camera stream:', stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      dispatch({ type: 'SET_CAMERA_STREAM', payload: stream });
      dispatch({ type: 'SET_CAMERA_ACTIVE', payload: true });
      dispatch({ type: 'SET_CAMERA_PERMISSION', payload: true });
      
    } catch (error) {
      console.error('Error starting camera:', error);
      let errorMessage = 'Failed to access camera';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
        }
      }
      
      dispatch({ type: 'SET_CAMERA_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_CAMERA_PERMISSION', payload: false });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [camera.stream, dispatch]);

  // Capture photo with optional auto-upload
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      dispatch({ type: 'SET_LOADING', payload: true });

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not get canvas context');
      }

      // Set canvas dimensions to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob with high quality
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob: Blob | null) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create image blob'));
            }
          },
          'image/jpeg',
          0.95 // High quality
        );
      });

      // Create data URL for preview
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

      // Create CapturedPhoto object
      const photo: CapturedPhoto = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        blob,
        dataUrl,
        timestamp: new Date(),
        dimensions: {
          width: canvas.width,
          height: canvas.height
        }
      };

      // Update app state
      dispatch({ type: 'SET_PHOTO', payload: photo });
      
      // Call capture callback
      onPhotoCapture(photo);

      // Auto-upload if enabled
      if (autoUpload) {
        console.log('Auto-uploading captured photo...');
        const uploadResult = await uploadCameraCapture(blob, {
          onProgress: (progress) => {
            console.log(`Upload progress: ${progress.percentage}%`);
          }
        });

        if (uploadResult.success && uploadResult.fileUrl) {
          console.log('Photo uploaded successfully:', uploadResult.fileUrl);
          onPhotoUploaded(uploadResult.fileUrl, photo);
        } else {
          console.error('Auto-upload failed:', uploadResult.error);
          dispatch({ type: 'SET_UI_ERROR', payload: `Upload failed: ${uploadResult.error}` });
        }
      }

    } catch (error) {
      console.error('Error capturing photo:', error);
      dispatch({ type: 'SET_CAMERA_ERROR', payload: 'Failed to capture photo. Please try again.' });
    } finally {
      setIsCapturing(false);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [isCapturing, dispatch, onPhotoCapture, onPhotoUploaded, autoUpload, uploadCameraCapture]);

  // Manual upload function for captured photos
  const uploadCurrentPhoto = useCallback(async () => {
    const currentPhoto = state.app.currentPhoto;
    if (!currentPhoto) {
      dispatch({ type: 'SET_UI_ERROR', payload: 'No photo to upload' });
      return;
    }

    console.log('Uploading current photo...');
    const uploadResult = await uploadCameraCapture(currentPhoto.blob, {
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress.percentage}%`);
      }
    });

    if (uploadResult.success && uploadResult.fileUrl) {
      console.log('Photo uploaded successfully:', uploadResult.fileUrl);
      onPhotoUploaded(uploadResult.fileUrl, currentPhoto);
    } else {
      console.error('Upload failed:', uploadResult.error);
      dispatch({ type: 'SET_UI_ERROR', payload: `Upload failed: ${uploadResult.error}` });
    }
  }, [state.app.currentPhoto, uploadCameraCapture, onPhotoUploaded, dispatch]);

  // Switch camera device
  const switchCamera = useCallback((deviceId: string) => {
    setCurrentDeviceId(deviceId);
    startCamera(deviceId);
  }, [startCamera]);

  // Initialize camera on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('CameraCapture: Initializing...');
      isInitializedRef.current = true;
      getDevices();
    }
  }, []);

  // Effect to set video stream when video element becomes available
  useEffect(() => {
    if (camera.stream && videoRef.current && !videoRef.current.srcObject) {
      console.log('CameraCapture: Setting stream in effect - video element now available');
      videoRef.current.srcObject = camera.stream;
      
      videoRef.current.onloadedmetadata = () => {
        console.log('CameraCapture: Video metadata loaded in effect');
        if (videoRef.current) {
          videoRef.current.play().catch((e: any) => console.error('Error playing video in effect:', e));
        }
      };
    }
  }, [camera.stream, camera.isActive]);

  // Enable camera access
  const enableCamera = async () => {
    console.log('CameraCapture: Enabling camera...');
    dispatch({ type: 'SET_CAMERA_ERROR', payload: null });
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        } 
      });
      
      console.log('CameraCapture: Got stream:', stream);
      
      dispatch({ type: 'SET_CAMERA_STREAM', payload: stream });
      dispatch({ type: 'SET_CAMERA_ACTIVE', payload: true });
      dispatch({ type: 'SET_CAMERA_PERMISSION', payload: true });
      
      const setVideoStream = (retryCount = 0) => {
        if (videoRef.current) {
          console.log('CameraCapture: Setting video srcObject', {
            videoElement: videoRef.current,
            isConnected: videoRef.current.isConnected,
            readyState: videoRef.current.readyState,
            retryCount
          });
          
          videoRef.current.srcObject = stream;
          
          videoRef.current.onloadedmetadata = () => {
            console.log('CameraCapture: Video metadata loaded');
            if (videoRef.current) {
              videoRef.current.play().catch((e: any) => console.error('Error playing video:', e));
            }
          };
          
          videoRef.current.oncanplay = () => {
            console.log('CameraCapture: Video can play');
          };
          
          videoRef.current.onplay = () => {
            console.log('CameraCapture: Video started playing');
          };
          
          videoRef.current.onerror = (e: any) => {
            console.error('CameraCapture: Video error:', e);
          };
        } else {
          console.error('CameraCapture: videoRef.current is null, retry count:', retryCount);
          if (retryCount < 5) {
            setTimeout(() => setVideoStream(retryCount + 1), 100 * (retryCount + 1));
          }
        }
      };
      
      setVideoStream();
      console.log('CameraCapture: Camera should now be active');
      
    } catch (error) {
      console.error('Error enabling camera:', error);
      let errorMessage = 'Failed to access camera';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
        }
      }
      
      dispatch({ type: 'SET_CAMERA_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const isUploadInProgress = uploadState.isUploading;
  const uploadProgress = uploadState.progress;
  const uploadError = uploadState.error;

  return (
    <div className={`camera-capture ${className}`}>
      {/* Camera preview */}
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
        {camera.isActive && !camera.error && camera.stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Camera preview"
              className="w-full h-full object-cover"
              onLoadedData={() => console.log('Video loaded data event')}
              onPlay={() => console.log('Video play event')}
              onError={(e) => console.error('Video error event:', e)}
            />
            
            {/* Camera overlay UI */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-80 border-2 border-white/50 rounded-full opacity-30"></div>
              </div>
              
              {/* Loading/Upload overlay */}
              {(ui.isLoading || isCapturing || isUploadInProgress) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p>
                      {isCapturing ? 'Capturing...' : 
                       isUploadInProgress ? `Uploading... ${uploadProgress?.percentage || 0}%` :
                       'Loading camera...'}
                    </p>
                    {isUploadInProgress && uploadProgress && (
                      <div className="w-48 bg-gray-700 rounded-full h-2 mt-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress.percentage}%` }}
                        ></div>
                      </div>
                    )}
                    {isUploadInProgress && (
                      <button
                        onClick={cancelUpload}
                        className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Cancel Upload
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Error or permission state */
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center p-6">
              {camera.error ? (
                <>
                  <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-red-400 mb-4">{camera.error}</p>
                  <button
                    onClick={enableCamera}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 mb-4">
                    {ui.isLoading ? 'Initializing camera...' : 'Camera access required'}
                  </p>
                  {!ui.isLoading && (
                    <button
                      onClick={enableCamera}
                      disabled={ui.isLoading}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Enable Camera
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload error display */}
      {uploadError && (
        <div className="mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="text-sm">{uploadError}</p>
          <button
            onClick={resetUpload}
            className="mt-1 text-xs text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Camera controls */}
      {camera.isActive && !camera.error && (
        <div className="mt-4 space-y-4">
          {/* Capture and upload buttons */}
          <div className="flex justify-center space-x-4">
            {/* Capture button */}
            <button
              onClick={capturePhoto}
              disabled={isCapturing || ui.isLoading || isUploadInProgress}
              aria-label="Capture photo"
              className="w-16 h-16 bg-white border-4 border-purple-600 rounded-full hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isCapturing ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
              ) : (
                <div className="w-8 h-8 bg-purple-600 rounded-full"></div>
              )}
            </button>

            {/* Manual upload button (only show if not auto-uploading and photo exists) */}
            {!autoUpload && state.app.currentPhoto && (
              <button
                onClick={uploadCurrentPhoto}
                disabled={isUploadInProgress}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadInProgress ? 'Uploading...' : 'Upload Photo'}
              </button>
            )}
          </div>

          {/* Camera switching (mobile) */}
          {devices.length > 1 && (
            <div className="flex justify-center">
              <div className="flex space-x-2">
                {devices.map((device: MediaDeviceInfo) => (
                  <button
                    key={device.deviceId}
                    onClick={() => switchCamera(device.deviceId)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      currentDeviceId === device.deviceId
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {device.label || `Camera ${devices.indexOf(device) + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}