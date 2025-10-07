import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { AppState, CameraState, UIState } from '../types';

// Combined application state
interface GlobalState {
  app: AppState;
  camera: CameraState;
  ui: UIState;
}

// Action types
type AppAction =
  | { type: 'SET_PHOTO'; payload: AppState['currentPhoto'] }
  | { type: 'SET_THEME'; payload: AppState['selectedTheme'] }
  | { type: 'SET_VARIANT'; payload: AppState['selectedVariant'] }
  | { type: 'SET_PROCESSING_STATUS'; payload: AppState['processingStatus'] }
  | { type: 'SET_POSE_OPTIONS'; payload: { action: string; mood: string; generatePose: boolean } }
  | { type: 'SET_CAMERA_ACTIVE'; payload: boolean }
  | { type: 'SET_CAMERA_PERMISSION'; payload: boolean }
  | { type: 'SET_CAMERA_ERROR'; payload: string | null }
  | { type: 'SET_CAMERA_STREAM'; payload: MediaStream | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CURRENT_STEP'; payload: UIState['currentStep'] }
  | { type: 'SET_UI_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: GlobalState = {
  app: {
    currentPhoto: null,
    selectedTheme: null,
    selectedVariant: null,
    processingStatus: null,
    poseOptions: {
      action: 'serious-look',
      mood: 'epic',
      generatePose: false
    },
  },
  camera: {
    isActive: false,
    hasPermission: false,
    error: null,
    stream: null,
  },
  ui: {
    isLoading: false,
    currentStep: 'capture',
    error: null,
  },
};

// Reducer function
function appReducer(state: GlobalState, action: AppAction): GlobalState {
  console.log('AppContext reducer:', action.type, 'payload' in action ? action.payload : 'no payload');
  switch (action.type) {
    case 'SET_PHOTO':
      return {
        ...state,
        app: { ...state.app, currentPhoto: action.payload },
      };
    case 'SET_THEME':
      return {
        ...state,
        app: { ...state.app, selectedTheme: action.payload },
      };
    case 'SET_VARIANT':
      return {
        ...state,
        app: { ...state.app, selectedVariant: action.payload },
      };
    case 'SET_PROCESSING_STATUS':
      return {
        ...state,
        app: { ...state.app, processingStatus: action.payload },
      };
    case 'SET_POSE_OPTIONS':
      return {
        ...state,
        app: { ...state.app, poseOptions: action.payload },
      };
    case 'SET_CAMERA_ACTIVE':
      return {
        ...state,
        camera: { ...state.camera, isActive: action.payload },
      };
    case 'SET_CAMERA_PERMISSION':
      return {
        ...state,
        camera: { ...state.camera, hasPermission: action.payload },
      };
    case 'SET_CAMERA_ERROR':
      return {
        ...state,
        camera: { ...state.camera, error: action.payload },
      };
    case 'SET_CAMERA_STREAM':
      return {
        ...state,
        camera: { ...state.camera, stream: action.payload },
      };
    case 'SET_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload },
      };
    case 'SET_CURRENT_STEP':
      return {
        ...state,
        ui: { ...state.ui, currentStep: action.payload },
      };
    case 'SET_UI_ERROR':
      return {
        ...state,
        ui: { ...state.ui, error: action.payload },
      };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: GlobalState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// Convenience hooks for specific state slices
export function useAppState() {
  const { state } = useAppContext();
  return state.app;
}

export function useCameraState() {
  const { state } = useAppContext();
  return state.camera;
}

export function useUIState() {
  const { state } = useAppContext();
  return state.ui;
}