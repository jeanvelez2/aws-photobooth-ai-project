export interface CapturedPhoto {
  id: string;
  blob: Blob;
  dataUrl: string;
  timestamp: Date;
  dimensions: {
    width: number;
    height: number;
  };
}
