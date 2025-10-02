export interface ProcessingRequest {
  photoId: string;
  themeId: string;
  variantId?: string | undefined;
  outputFormat: 'jpeg' | 'png';
  userId?: string | undefined;
  originalImageUrl: string;
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

export interface ProcessingProgress {
  jobId: string;
  stage: 'uploading' | 'detecting' | 'processing' | 'blending' | 'finalizing';
  progress: number;
  message: string;
}

export interface ProcessingConfig {
  maxProcessingTime: number;
  maxRetries: number;
  qualityThresholds: {
    minConfidence: number;
    minBrightness: number;
    minSharpness: number;
    maxPoseAngle: number;
  };
}
