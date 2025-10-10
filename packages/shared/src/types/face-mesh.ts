export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Triangle {
  vertices: [number, number, number]; // Indices into vertex array
}

export interface UVCoordinate {
  u: number;
  v: number;
}

export interface NormalVector {
  x: number;
  y: number;
  z: number;
}

export interface FaceMesh {
  vertices: Vector3[];
  triangles: Triangle[];
  uvMapping: UVCoordinate[];
  normalMap: NormalVector[];
  boundingBox: {
    min: Vector3;
    max: Vector3;
  };
}

export interface OptimizedMesh extends FaceMesh {
  optimizationLevel: number;
  vertexCount: number;
  triangleCount: number;
  qualityScore: number;
}

export interface MeshQualityMetrics {
  vertexCount: number;
  triangleCount: number;
  aspectRatio: number;
  symmetryScore: number;
  smoothnessScore: number;
  topologyScore: number;
  overallQuality: number;
}

export interface FaceMeshGenerationOptions {
  resolution: 'low' | 'medium' | 'high';
  smoothingIterations: number;
  preserveFeatures: boolean;
  generateNormals: boolean;
  generateUVMapping: boolean;
}

export interface MeshValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  qualityMetrics: MeshQualityMetrics;
}