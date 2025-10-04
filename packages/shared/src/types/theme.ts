export interface Theme {
  id: string;
  name: string;
  description: string;
  category: string;
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
  gender?: 'Male' | 'Female';
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
