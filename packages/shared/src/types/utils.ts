export interface Dimensions {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ColorAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
}

export interface Transform {
  scale: number;
  rotation: number;
  translation: Position;
}

export type ImageFormat = 'jpeg' | 'png' | 'webp';

export type ProcessingStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface UploadConfig {
  maxFileSize: number;
  allowedFormats: ImageFormat[];
  expirationMinutes: number;
}