// Define types locally for now - will be imported from shared package in later tasks
export interface CapturedPhoto {
  id: string;
  blob: Blob;
  dataUrl: string;
  s3Url?: string; // S3 URL after upload
  timestamp: Date;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  templateUrl: string;
  variants: ThemeVariant[];
}

export interface ThemeVariant {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl: string;
  templateUrl: string;
  faceRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  blendingMask?: string;
  colorAdjustments: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
  };
}

export interface ProcessingRequest {
  photoId: string;
  themeId: string;
  variantId?: string;
  outputFormat: 'jpeg' | 'png';
  userId?: string;
  originalImageUrl: string;
  action?: string;
  mood?: 'epic' | 'dark' | 'bright' | 'mystical';
  generatePose?: boolean;
}

export interface ProcessingResult {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  processingTime?: number;
  progress?: number;
  createdAt: Date;
  completedAt?: Date;
}

// Frontend-specific types
export interface AppState {
  currentPhoto: CapturedPhoto | null;
  selectedTheme: Theme | null;
  selectedVariant: ThemeVariant | null;
  processingStatus: ProcessingResult | null;
  poseOptions: {
    action: string;
    mood: string;
    generatePose: boolean;
  };
}

export interface CameraState {
  isActive: boolean;
  hasPermission: boolean;
  error: string | null;
  stream: MediaStream | null;
}

export interface UIState {
  isLoading: boolean;
  currentStep: 'capture' | 'theme-selection' | 'processing' | 'result';
  error: string | null;
}