declare module 'onnxruntime-node' {
  export interface Tensor {
    data: Float32Array | Int32Array | BigInt64Array | Uint8Array;
    dims: number[];
    type: string;
  }

  export interface InferenceSession {
    inputNames: string[];
    outputNames: string[];
    inputMetadata: Record<string, { dims: number[]; type: string }>;
    outputMetadata: Record<string, { dims: number[]; type: string }>;
    run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
    release(): Promise<void>;
  }

  export namespace InferenceSession {
    export interface SessionOptions {
      executionProviders?: ExecutionProvider[];
      graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
      enableCpuMemArena?: boolean;
      enableMemPattern?: boolean;
      executionMode?: 'sequential' | 'parallel';
      providers?: Array<{
        name: string;
        deviceId?: number;
        [key: string]: any;
      }>;
    }

    export function create(modelPath: string, options?: SessionOptions): Promise<InferenceSession>;
  }

  export type ExecutionProvider = 'cpu' | 'cuda' | 'tensorrt' | 'dml';

  export class Tensor {
    constructor(type: string, data: Float32Array | Int32Array | BigInt64Array | Uint8Array, dims: number[]);
    data: Float32Array | Int32Array | BigInt64Array | Uint8Array;
    dims: number[];
    type: string;
  }

  export const env: {
    executionProviders: ExecutionProvider[];
    logLevel: 'verbose' | 'info' | 'warning' | 'error' | 'fatal';
  };
}