export interface ProcessingJob {
  jobId: string;
  userId?: string | undefined;
  originalImageUrl: string;
  themeId: string;
  variantId?: string | undefined;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  resultImageUrl?: string | undefined;
  error?: string | undefined;
  createdAt: Date;
  completedAt?: Date | undefined;
  processingTimeMs?: number | undefined;
  retryCount: number;
  outputFormat: 'jpeg' | 'png';
}

export interface ThemeTemplate {
  id: string;
  name: string;
  description: string;
  backgroundImage: string;
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  successRate: number;
}