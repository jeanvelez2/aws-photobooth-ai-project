import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import CameraCapture from '../components/CameraCapture';
import type { CapturedPhoto } from '../types';

export default function CapturePage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(state.app.currentPhoto);

  React.useEffect(() => {
    // Set current step when component mounts
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'capture' });
  }, [dispatch]);

  const handlePhotoCapture = (photo: CapturedPhoto) => {
    setCapturedPhoto(photo);
    // Photo is already set in global state by CameraCapture component
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    dispatch({ type: 'SET_PHOTO', payload: null });
  };

  const handleContinue = () => {
    if (capturedPhoto) {
      navigate('/themes');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Take Your Photo
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Position yourself in the camera frame and capture a clear photo of your face. 
          Make sure you're well-lit and looking directly at the camera for the best results.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        {!capturedPhoto ? (
          /* Camera capture mode */
          <CameraCapture 
            onPhotoCapture={handlePhotoCapture}
            className="mb-6"
          />
        ) : (
          /* Photo preview mode */
          <div className="space-y-6">
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <img 
                src={capturedPhoto.dataUrl} 
                alt="Captured photo"
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleRetake}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Retake Photo
              </button>
              <button
                onClick={handleContinue}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Continue to Themes
              </button>
            </div>
            
            {/* Photo info */}
            <div className="text-center text-sm text-gray-500">
              <p>Photo captured: {capturedPhoto.dimensions.width} × {capturedPhoto.dimensions.height}px</p>
              <p>Size: {(capturedPhoto.blob.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Tips section */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Tips for the best results:</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            Ensure good lighting on your face
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            Look directly at the camera
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            Keep your face centered in the frame
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            Avoid extreme angles or poses
          </li>
        </ul>
      </div>
    </div>
  );
}