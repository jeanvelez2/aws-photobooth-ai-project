export interface ProcessingRequest {
  photoId: string;
  themeId: string;
  variantId?: string | undefined;
  outputFormat: 'jpeg' | 'png';
  userId?: string | undefined;
  originalImageUrl: string;
  action?: string;
  mood?: 'epic' | 'dark' | 'bright' | 'mystical';
  generatePose?: boolean;
}

export interface ProcessingJob {
  jobId: string;
  userId?: string;
  originalImageUrl: string;
  themeId: string;
  variantId?: string;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  resultImageUrl?: string;
  error?: string;
  processingTimeMs?: number;
  retryCount: number;
  outputFormat: 'jpeg' | 'png';
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  imageUrl?: string;
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

export type JobStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
