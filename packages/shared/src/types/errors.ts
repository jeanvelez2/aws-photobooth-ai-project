export enum ProcessingErrorType {
  NO_FACE_DETECTED = 'NO_FACE_DETECTED',
  MULTIPLE_FACES = 'MULTIPLE_FACES',
  POOR_IMAGE_QUALITY = 'POOR_IMAGE_QUALITY',
  FACE_TOO_SMALL = 'FACE_TOO_SMALL',
  EXTREME_POSE = 'EXTREME_POSE',
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
  THEME_NOT_FOUND = 'THEME_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_IMAGE_FORMAT = 'INVALID_IMAGE_FORMAT',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
}

export interface ProcessingError {
  type: ProcessingErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  suggestions?: string[];
  recoveryActions?: RecoveryAction[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: Date;
  requestId?: string;
  context?: Record<string, any>;
}

export interface RecoveryAction {
  type: 'retry' | 'goBack' | 'startOver' | 'selectTheme' | 'retakePhoto' | 'refresh' | 'contact' | 'resetConnection';
  label: string;
  description?: string;
  primary?: boolean;
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  timestamp: Date;
  service?: string;
  httpStatus?: number;
  jobId?: string;
  primaryError?: string;
  elapsed?: number;
  consecutiveErrors?: number;
}

export interface ErrorLogEntry {
  id: string;
  error: ProcessingError;
  context: ErrorContext;
  resolved?: boolean;
  resolvedAt?: Date;
  resolution?: string;
}
