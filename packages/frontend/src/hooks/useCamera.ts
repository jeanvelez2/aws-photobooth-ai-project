import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export function useCamera() {
  const { state, dispatch } = useAppContext();
  const { camera } = state;
  
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');

  // Check if camera is supported
  const isCameraSupported = useCallback(() => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }, []);

  // Get available camera devices
  const getDevices = useCallback(async () => {
    if (!isCameraSupported()) {
      dispatch({ type: 'SET_CAMERA_ERROR', payload: 'Camera not supported in this browser' });
      return [];
    }

    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${deviceList.indexOf(device) + 1}`,
          kind: device.kind
        }));
      
      setDevices(videoDevices);
      
      // Set default device (prefer back camera on mobile)
      if (videoDevices.length > 0 && !currentDeviceId) {
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        const defaultDevice = backCamera || videoDevices[0];
        if (defaultDevice) {
          setCurrentDeviceId(defaultDevice.deviceId);
        }
      }
      
      return videoDevices;
    } catch (error) {
      console.error('Error getting camera devices:', error);
      dispatch({ type: 'SET_CAMERA_ERROR', payload: 'Failed to get camera devices' });
      return [];
    }
  }, [currentDeviceId, dispatch, isCameraSupported]);

  // Request camera permissions
  const requestPermissions = useCallback(async () => {
    if (!isCameraSupported()) {
      dispatch({ type: 'SET_CAMERA_ERROR', payload: 'Camera not supported in this browser' });
      return false;
    }

    try {
      // Request basic camera access to get permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      
      // Stop the stream immediately - we just needed permissions
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      
      dispatch({ type: 'SET_CAMERA_PERMISSION', payload: true });
      dispatch({ type: 'SET_CAMERA_ERROR', payload: null });
      
      // Now get the actual device list
      await getDevices();
      
      return true;
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      
      let errorMessage = 'Failed to access camera';
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
            break;
          case 'NotFoundError':
            errorMessage = 'No camera found. Please connect a camera and try again.';
            break;
          case 'NotReadableError':
            errorMessage = 'Camera is already in use by another application.';
            break;
          case 'OverconstrainedError':
            errorMessage = 'Camera constraints could not be satisfied.';
            break;
          case 'SecurityError':
            errorMessage = 'Camera access blocked due to security restrictions.';
            break;
          default:
            errorMessage = `Camera error: ${error.message}`;
        }
      }
      
      dispatch({ type: 'SET_CAMERA_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_CAMERA_PERMISSION', payload: false });
      return false;
    }
  }, [dispatch, getDevices, isCameraSupported]);

  // Start camera with specific device
  const startCamera = useCallback(async (deviceId?: string) => {
    if (!camera.hasPermission) {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return null;
    }

    try {
      dispatch({ type: 'SET_CAMERA_ERROR', payload: null });

      // Stop existing stream
      if (camera.stream) {
        camera.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }

      const targetDeviceId = deviceId || currentDeviceId;
      
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      };

      if (targetDeviceId) {
        videoConstraints.deviceId = { exact: targetDeviceId };
      } else {
        videoConstraints.facingMode = { ideal: 'user' };
      }

      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      dispatch({ type: 'SET_CAMERA_STREAM', payload: stream });
      dispatch({ type: 'SET_CAMERA_ACTIVE', payload: true });
      
      if (deviceId) {
        setCurrentDeviceId(deviceId);
      }
      
      return stream;
    } catch (error) {
      console.error('Error starting camera:', error);
      
      let errorMessage = 'Failed to start camera';
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Camera permission denied. Please allow camera access and try again.';
            break;
          case 'NotFoundError':
            errorMessage = 'Selected camera not found. Please try a different camera.';
            break;
          case 'NotReadableError':
            errorMessage = 'Camera is already in use by another application.';
            break;
          case 'OverconstrainedError':
            errorMessage = 'Camera does not support the required resolution.';
            break;
          default:
            errorMessage = `Camera error: ${error.message}`;
        }
      }
      
      dispatch({ type: 'SET_CAMERA_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_CAMERA_ACTIVE', payload: false });
      return null;
    }
  }, [camera.hasPermission, camera.stream, currentDeviceId, dispatch, requestPermissions]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (camera.stream) {
      camera.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      dispatch({ type: 'SET_CAMERA_STREAM', payload: null });
    }
    dispatch({ type: 'SET_CAMERA_ACTIVE', payload: false });
  }, [camera.stream, dispatch]);

  // Switch to different camera
  const switchCamera = useCallback(async (deviceId: string) => {
    setCurrentDeviceId(deviceId);
    return await startCamera(deviceId);
  }, [startCamera]);

  // Get camera capabilities
  const getCameraCapabilities = useCallback(async (deviceId?: string) => {
    try {
      const targetDeviceId = deviceId || currentDeviceId;
      if (!targetDeviceId) return null;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: targetDeviceId } }
      });

      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        return null;
      }
      
      const capabilities = track.getCapabilities();
      
      // Clean up
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      
      return capabilities;
    } catch (error) {
      console.error('Error getting camera capabilities:', error);
      return null;
    }
  }, [currentDeviceId]);

  // Initialize on mount
  useEffect(() => {
    if (isCameraSupported()) {
      getDevices();
    } else {
      dispatch({ type: 'SET_CAMERA_ERROR', payload: 'Camera not supported in this browser' });
    }
  }, [getDevices, dispatch, isCameraSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    // State
    camera,
    devices,
    currentDeviceId,
    
    // Actions
    requestPermissions,
    startCamera,
    stopCamera,
    switchCamera,
    getDevices,
    getCameraCapabilities,
    
    // Utilities
    isCameraSupported
  };
}