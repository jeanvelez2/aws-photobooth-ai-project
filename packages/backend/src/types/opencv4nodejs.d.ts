declare module 'opencv4nodejs' {
  export class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  export class Size {
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  export class Rect {
    constructor(x: number, y: number, width: number, height: number);
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export class Vec {
    constructor(values: number[]);
  }

  export class Mat {
    rows: number;
    cols: number;
    channels: number;
    at(row: number, col: number): number | number[];
    set(row: number, col: number, value: number | number[]): void;
    clone(): Mat;
    resize(rows: number, cols: number, fx?: number, fy?: number, interpolation?: number): Mat;
    cvtColor(code: number): Mat;
    convertTo(rtype: number, alpha?: number, beta?: number): Mat;
    gaussianBlur(ksize: Size, sigmaX: number, sigmaY?: number): Mat;
    getRegion(rect: Rect): Mat;
    static zeros(rows: number, cols: number, type: number): Mat;
  }

  export class CascadeClassifier {
    constructor(xmlFilePath: string);
    detectMultiScale(image: Mat, options?: {
      scaleFactor?: number;
      minNeighbors?: number;
      minSize?: Size;
      maxSize?: Size;
    }): { objects: Rect[]; numDetections: number[] };
  }

  export const HAAR_FRONTALFACE_ALT2: string;
  export const HAAR_EYE: string;
  export const COLOR_BGR2GRAY: number;
  export const COLOR_BGR2RGB: number;
  export const CV_8UC1: number;
  export const CV_8UC3: number;
  export const CV_32F: number;
  export const CV_32FC3: number;
  export const CV_8U: number;
  export const INTER_LINEAR: number;
  export const INTER_CUBIC: number;
  export const INTER_NEAREST: number;
  export const INTER: {
    LINEAR: number;
    CUBIC: number;
    NEAREST: number;
  };
  export const IMWRITE_JPEG_QUALITY: number;
  export const IMWRITE_PNG_COMPRESSION: number;

  export function imdecode(buffer: Buffer): Mat;
  export function imencode(ext: string, mat: Mat, params?: number[]): Buffer;
  export function ellipse(
    img: Mat,
    center: Point,
    axes: Size,
    angle: number,
    startAngle: number,
    endAngle: number,
    color: Vec,
    thickness?: number
  ): void;
}