import {
  FacialLandmark,
  Vector3,
  Vector2,
  Triangle,
  UVCoordinate,
  NormalVector,
  FaceMesh,
  OptimizedMesh,
  MeshQualityMetrics,
  FaceMeshGenerationOptions,
  MeshValidationResult,
} from 'shared';
import { logger } from '../utils/logger.js';

/**
 * FaceMeshGenerator creates 3D face meshes from 2D facial landmarks
 * for advanced style transfer and texture application
 */
export class FaceMeshGenerator {
  private readonly DEFAULT_OPTIONS: FaceMeshGenerationOptions = {
    resolution: 'medium',
    smoothingIterations: 3,
    preserveFeatures: true,
    generateNormals: true,
    generateUVMapping: true,
  };

  // Standard face topology template based on facial landmark positions
  private readonly FACE_TOPOLOGY_TEMPLATE = {
    // Eye regions
    leftEye: [0, 1, 2, 3, 4, 5],
    rightEye: [6, 7, 8, 9, 10, 11],
    // Nose region
    nose: [12, 13, 14, 15, 16],
    // Mouth region
    mouth: [17, 18, 19, 20, 21, 22, 23],
    // Jawline and chin
    jawline: [24, 25, 26, 27, 28, 29, 30],
    // Forehead and eyebrows
    forehead: [31, 32, 33, 34, 35, 36],
  };

  /**
   * Generate 3D face mesh from 2D facial landmarks
   */
  async generateMesh(
    landmarks: FacialLandmark[],
    options: Partial<FaceMeshGenerationOptions> = {}
  ): Promise<FaceMesh> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    try {
      logger.info('Starting face mesh generation', {
        landmarkCount: landmarks.length,
        resolution: opts.resolution,
      });

      // Validate input landmarks
      this.validateLandmarks(landmarks);

      // Convert 2D landmarks to 3D vertices with depth estimation
      const vertices = this.generate3DVertices(landmarks, opts);

      // Generate face topology triangulation
      const triangles = this.generateTriangulation(vertices, opts);

      // Generate UV mapping for texture application
      const uvMapping = opts.generateUVMapping 
        ? this.generateUVMapping(vertices, landmarks)
        : [];

      // Calculate normal vectors for lighting
      const normalMap = opts.generateNormals
        ? this.calculateNormals(vertices, triangles)
        : [];

      // Calculate bounding box
      const boundingBox = this.calculateBoundingBox(vertices);

      const mesh: FaceMesh = {
        vertices,
        triangles,
        uvMapping,
        normalMap,
        boundingBox,
      };

      // Apply smoothing if requested and we have triangles
      if (opts.smoothingIterations > 0 && mesh.triangles.length > 0) {
        this.smoothMesh(mesh, opts.smoothingIterations);
      }

      logger.info('Face mesh generation completed', {
        vertexCount: vertices.length,
        triangleCount: triangles.length,
        hasUVMapping: uvMapping.length > 0,
        hasNormals: normalMap.length > 0,
      });

      return mesh;

    } catch (error) {
      logger.error('Face mesh generation failed', { error: error instanceof Error ? error.message : error });
      throw new Error('MESH_GENERATION_FAILED');
    }
  }

  /**
   * Optimize mesh for better performance and quality
   */
  async optimizeMesh(mesh: FaceMesh, targetQuality: number = 0.8): Promise<OptimizedMesh> {
    try {
      logger.info('Starting mesh optimization', {
        originalVertexCount: mesh.vertices.length,
        targetQuality,
      });

      // Create a copy for optimization
      const optimizedMesh: OptimizedMesh = {
        ...JSON.parse(JSON.stringify(mesh)),
        optimizationLevel: 0,
        vertexCount: mesh.vertices.length,
        triangleCount: mesh.triangles.length,
        qualityScore: 0,
      };

      // Apply optimization techniques
      this.removeRedundantVertices(optimizedMesh);
      this.optimizeTriangulation(optimizedMesh);
      this.improveAspectRatios(optimizedMesh);

      // Calculate final quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(optimizedMesh);
      optimizedMesh.qualityScore = qualityMetrics.overallQuality;
      optimizedMesh.vertexCount = optimizedMesh.vertices.length;
      optimizedMesh.triangleCount = optimizedMesh.triangles.length;

      logger.info('Mesh optimization completed', {
        originalVertices: mesh.vertices.length,
        optimizedVertices: optimizedMesh.vertices.length,
        qualityScore: optimizedMesh.qualityScore,
      });

      return optimizedMesh;

    } catch (error) {
      logger.error('Mesh optimization failed', { error: error instanceof Error ? error.message : error });
      throw new Error('MESH_OPTIMIZATION_FAILED');
    }
  }

  /**
   * Validate mesh quality and topology
   */
  async validateMeshQuality(mesh: FaceMesh): Promise<MeshValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check basic mesh integrity
      if (mesh.vertices.length === 0) {
        errors.push('Mesh has no vertices');
      }

      if (mesh.triangles.length === 0) {
        errors.push('Mesh has no triangles');
      }

      // Validate triangle indices
      for (const triangle of mesh.triangles) {
        for (const vertexIndex of triangle.vertices) {
          if (vertexIndex < 0 || vertexIndex >= mesh.vertices.length) {
            errors.push(`Invalid vertex index: ${vertexIndex}`);
          }
        }
      }

      // Check for degenerate triangles
      const degenerateTriangles = this.findDegenerateTriangles(mesh);
      if (degenerateTriangles.length > 0) {
        warnings.push(`Found ${degenerateTriangles.length} degenerate triangles`);
      }

      // Calculate quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(mesh);

      // Quality thresholds
      if (qualityMetrics.aspectRatio < 0.3) {
        warnings.push('Poor triangle aspect ratios detected');
      }

      if (qualityMetrics.symmetryScore < 0.7) {
        warnings.push('Face mesh lacks symmetry');
      }

      if (qualityMetrics.smoothnessScore < 0.6) {
        warnings.push('Mesh surface is not smooth');
      }

      const isValid = errors.length === 0;

      logger.info('Mesh validation completed', {
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        overallQuality: qualityMetrics.overallQuality,
      });

      return {
        isValid,
        errors,
        warnings,
        qualityMetrics,
      };

    } catch (error) {
      logger.error('Mesh validation failed', { error: error instanceof Error ? error.message : error });
      
      // Return validation result instead of throwing
      return {
        isValid: false,
        errors: ['Mesh validation failed due to internal error'],
        warnings: [],
        qualityMetrics: {
          vertexCount: 0,
          triangleCount: 0,
          aspectRatio: 0,
          symmetryScore: 0,
          smoothnessScore: 0,
          topologyScore: 0,
          overallQuality: 0,
        },
      };
    }
  }

  /**
   * Validate input landmarks
   */
  private validateLandmarks(landmarks: FacialLandmark[]): void {
    if (landmarks.length < 27) {
      throw new Error('Insufficient landmarks for mesh generation');
    }

    // Check for required landmark types
    const requiredTypes = ['eyeLeft', 'eyeRight', 'nose', 'mouthLeft', 'mouthRight'];
    const availableTypes = new Set(landmarks.map(l => l.type));
    
    for (const requiredType of requiredTypes) {
      if (!availableTypes.has(requiredType as any)) {
        throw new Error(`Missing required landmark: ${requiredType}`);
      }
    }

    // Validate coordinate ranges
    for (const landmark of landmarks) {
      if (landmark.x < 0 || landmark.x > 1 || landmark.y < 0 || landmark.y > 1) {
        throw new Error('Landmark coordinates must be normalized between 0 and 1');
      }
    }
  }

  /**
   * Generate 3D vertices from 2D landmarks with depth estimation
   */
  private generate3DVertices(
    landmarks: FacialLandmark[],
    options: FaceMeshGenerationOptions
  ): Vector3[] {
    const vertices: Vector3[] = [];

    // Create base vertices from landmarks
    for (const landmark of landmarks) {
      // Estimate depth based on facial feature type and position
      const depth = this.estimateDepth(landmark);
      
      vertices.push({
        x: landmark.x,
        y: landmark.y,
        z: depth,
      });
    }

    // Add additional vertices based on resolution
    const additionalVertices = this.generateAdditionalVertices(landmarks, options.resolution);
    vertices.push(...additionalVertices);

    return vertices;
  }

  /**
   * Estimate depth for a landmark based on facial anatomy
   */
  private estimateDepth(landmark: FacialLandmark): number {
    // Depth estimation based on typical facial structure
    const depthMap: Record<string, number> = {
      // Eyes are relatively deep
      'eyeLeft': -0.02,
      'eyeRight': -0.02,
      'leftPupil': -0.025,
      'rightPupil': -0.025,
      
      // Nose protrudes forward
      'nose': 0.03,
      'noseLeft': 0.02,
      'noseRight': 0.02,
      
      // Mouth is slightly recessed
      'mouthLeft': -0.01,
      'mouthRight': -0.01,
      'mouthUp': -0.005,
      'mouthDown': -0.01,
      
      // Chin and jawline
      'chinBottom': 0.01,
      'upperJawlineLeft': 0.005,
      'upperJawlineRight': 0.005,
      'midJawlineLeft': 0.01,
      'midJawlineRight': 0.01,
      
      // Eyebrows are slightly forward
      'leftEyeBrowLeft': 0.005,
      'leftEyeBrowRight': 0.005,
      'leftEyeBrowUp': 0.005,
      'rightEyeBrowLeft': 0.005,
      'rightEyeBrowRight': 0.005,
      'rightEyeBrowUp': 0.005,
    };

    return depthMap[landmark.type] || 0;
  }

  /**
   * Generate additional vertices for higher resolution meshes
   */
  private generateAdditionalVertices(
    landmarks: FacialLandmark[],
    resolution: 'low' | 'medium' | 'high'
  ): Vector3[] {
    const additionalVertices: Vector3[] = [];

    // Resolution-based vertex density
    const vertexCounts = {
      low: 20,
      medium: 50,
      high: 100,
    };

    const targetCount = vertexCounts[resolution];

    // Generate interpolated vertices between key landmarks
    const keyLandmarks = this.getKeyLandmarks(landmarks);
    
    for (let i = 0; i < targetCount; i++) {
      const interpolatedVertex = this.interpolateVertex(keyLandmarks, i / targetCount);
      additionalVertices.push(interpolatedVertex);
    }

    return additionalVertices;
  }

  /**
   * Get key landmarks for interpolation
   */
  private getKeyLandmarks(landmarks: FacialLandmark[]): Vector3[] {
    const keyTypes = ['eyeLeft', 'eyeRight', 'nose', 'mouthLeft', 'mouthRight', 'chinBottom'];
    
    return landmarks
      .filter(l => keyTypes.includes(l.type))
      .map(l => ({
        x: l.x,
        y: l.y,
        z: this.estimateDepth(l),
      }));
  }

  /**
   * Interpolate vertex position based on key landmarks
   */
  private interpolateVertex(keyLandmarks: Vector3[], t: number): Vector3 {
    // Simple interpolation between key landmarks
    const index = Math.floor(t * (keyLandmarks.length - 1));
    const nextIndex = Math.min(index + 1, keyLandmarks.length - 1);
    const localT = (t * (keyLandmarks.length - 1)) - index;

    const current = keyLandmarks[index];
    const next = keyLandmarks[nextIndex];

    return {
      x: current.x + (next.x - current.x) * localT,
      y: current.y + (next.y - current.y) * localT,
      z: current.z + (next.z - current.z) * localT,
    };
  }

  /**
   * Generate triangulation for face topology
   */
  private generateTriangulation(
    vertices: Vector3[],
    options: FaceMeshGenerationOptions
  ): Triangle[] {
    const triangles: Triangle[] = [];

    // Use Delaunay triangulation for optimal triangle distribution
    const triangulation = this.delaunayTriangulation(vertices);
    
    // Convert to Triangle format
    for (const tri of triangulation) {
      triangles.push({
        vertices: [tri[0], tri[1], tri[2]] as [number, number, number],
      });
    }

    // Optimize triangulation for face topology
    this.optimizeFaceTriangulation(triangles, vertices);

    return triangles;
  }

  /**
   * Simple Delaunay triangulation implementation
   */
  private delaunayTriangulation(vertices: Vector3[]): number[][] {
    // Simplified triangulation - in production, use a proper Delaunay library
    const triangles: number[][] = [];
    
    if (vertices.length < 3) {
      return triangles;
    }
    
    // Create triangles connecting nearby vertices
    // Use a more conservative approach to ensure we get valid triangles
    for (let i = 0; i < vertices.length - 2; i++) {
      for (let j = i + 1; j < vertices.length - 1; j++) {
        for (let k = j + 1; k < vertices.length; k++) {
          // Check if triangle is valid (not degenerate)
          if (this.isValidTriangle(vertices[i], vertices[j], vertices[k])) {
            // Check distance constraint to avoid overly large triangles
            const maxDist = Math.max(
              this.distance3D(vertices[i], vertices[j]),
              this.distance3D(vertices[j], vertices[k]),
              this.distance3D(vertices[k], vertices[i])
            );
            
            if (maxDist < 0.3) { // Reasonable distance threshold
              triangles.push([i, j, k]);
            }
          }
        }
      }
    }

    // If no triangles were created with strict constraints, create some basic ones
    if (triangles.length === 0 && vertices.length >= 3) {
      // Create a simple fan triangulation from first vertex
      for (let i = 1; i < vertices.length - 1; i++) {
        if (this.isValidTriangle(vertices[0], vertices[i], vertices[i + 1])) {
          triangles.push([0, i, i + 1]);
        }
      }
    }

    // Limit triangles to prevent over-triangulation
    return triangles.slice(0, Math.min(triangles.length, vertices.length * 3));
  }

  /**
   * Check if triangle is valid (not degenerate)
   */
  private isValidTriangle(v1: Vector3, v2: Vector3, v3: Vector3): boolean {
    // Check if vertices are the same
    if (this.distance3D(v1, v2) < 0.001 || 
        this.distance3D(v2, v3) < 0.001 || 
        this.distance3D(v3, v1) < 0.001) {
      return false;
    }
    
    // Calculate triangle area using cross product
    const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
    const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
    
    const cross = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x,
    };
    
    const area = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z) / 2;
    
    // Triangle is valid if area is above threshold
    return area > 0.00001;
  }

  /**
   * Optimize triangulation for face topology
   */
  private optimizeFaceTriangulation(triangles: Triangle[], vertices: Vector3[]): void {
    // Remove triangles that cross facial features inappropriately
    // This is a simplified version - production would use more sophisticated algorithms
    
    const validTriangles: Triangle[] = [];
    
    for (const triangle of triangles) {
      if (this.isTriangleTopologicallyValid(triangle, vertices)) {
        validTriangles.push(triangle);
      }
    }
    
    // Replace original triangles with valid ones
    triangles.length = 0;
    triangles.push(...validTriangles);
  }

  /**
   * Check if triangle respects facial topology
   */
  private isTriangleTopologicallyValid(triangle: Triangle, vertices: Vector3[]): boolean {
    // Simple check - ensure triangle vertices are reasonably close
    const [i, j, k] = triangle.vertices;
    const v1 = vertices[i];
    const v2 = vertices[j];
    const v3 = vertices[k];
    
    const maxDistance = 0.2; // Maximum distance between triangle vertices
    
    const d12 = this.distance3D(v1, v2);
    const d23 = this.distance3D(v2, v3);
    const d31 = this.distance3D(v3, v1);
    
    return d12 < maxDistance && d23 < maxDistance && d31 < maxDistance;
  }

  /**
   * Calculate 3D distance between two points
   */
  private distance3D(v1: Vector3, v2: Vector3): number {
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const dz = v2.z - v1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Generate UV mapping for texture application
   */
  private generateUVMapping(vertices: Vector3[], landmarks: FacialLandmark[]): UVCoordinate[] {
    const uvCoordinates: UVCoordinate[] = [];

    // Create UV coordinates based on facial landmark positions
    for (const vertex of vertices) {
      // Map 3D vertex to 2D UV space
      // This is a simplified mapping - production would use more sophisticated unwrapping
      const u = (vertex.x + 1) / 2; // Normalize to [0, 1]
      const v = (vertex.y + 1) / 2; // Normalize to [0, 1]
      
      uvCoordinates.push({ u, v });
    }

    return uvCoordinates;
  }

  /**
   * Calculate normal vectors for lighting
   */
  private calculateNormals(vertices: Vector3[], triangles: Triangle[]): NormalVector[] {
    const normals: NormalVector[] = new Array(vertices.length).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
    const counts: number[] = new Array(vertices.length).fill(0);

    // If no triangles, generate default normals pointing forward
    if (triangles.length === 0) {
      return vertices.map(() => ({ x: 0, y: 0, z: 1 }));
    }

    // Calculate face normals and accumulate vertex normals
    for (const triangle of triangles) {
      const [i, j, k] = triangle.vertices;
      
      // Validate indices
      if (i >= vertices.length || j >= vertices.length || k >= vertices.length) {
        continue;
      }
      
      const v1 = vertices[i];
      const v2 = vertices[j];
      const v3 = vertices[k];

      // Calculate face normal using cross product
      const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
      const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
      
      const normal = {
        x: edge1.y * edge2.z - edge1.z * edge2.y,
        y: edge1.z * edge2.x - edge1.x * edge2.z,
        z: edge1.x * edge2.y - edge1.y * edge2.x,
      };

      // Normalize
      const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
      if (length > 0) {
        normal.x /= length;
        normal.y /= length;
        normal.z /= length;
      } else {
        // Default normal if degenerate
        normal.x = 0;
        normal.y = 0;
        normal.z = 1;
      }

      // Accumulate for each vertex
      for (const vertexIndex of triangle.vertices) {
        if (vertexIndex < normals.length) {
          normals[vertexIndex].x += normal.x;
          normals[vertexIndex].y += normal.y;
          normals[vertexIndex].z += normal.z;
          counts[vertexIndex]++;
        }
      }
    }

    // Average and normalize vertex normals
    for (let i = 0; i < normals.length; i++) {
      if (counts[i] > 0) {
        normals[i].x /= counts[i];
        normals[i].y /= counts[i];
        normals[i].z /= counts[i];

        // Normalize
        const length = Math.sqrt(
          normals[i].x * normals[i].x + 
          normals[i].y * normals[i].y + 
          normals[i].z * normals[i].z
        );
        
        if (length > 0) {
          normals[i].x /= length;
          normals[i].y /= length;
          normals[i].z /= length;
        } else {
          // Default normal if no valid calculation
          normals[i].x = 0;
          normals[i].y = 0;
          normals[i].z = 1;
        }
      } else {
        // Default normal for vertices not in any triangle
        normals[i].x = 0;
        normals[i].y = 0;
        normals[i].z = 1;
      }
    }

    return normals;
  }

  /**
   * Calculate mesh bounding box
   */
  private calculateBoundingBox(vertices: Vector3[]): { min: Vector3; max: Vector3 } {
    if (vertices.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      };
    }

    const min = { ...vertices[0] };
    const max = { ...vertices[0] };

    for (const vertex of vertices) {
      min.x = Math.min(min.x, vertex.x);
      min.y = Math.min(min.y, vertex.y);
      min.z = Math.min(min.z, vertex.z);
      
      max.x = Math.max(max.x, vertex.x);
      max.y = Math.max(max.y, vertex.y);
      max.z = Math.max(max.z, vertex.z);
    }

    return { min, max };
  }

  /**
   * Apply Laplacian smoothing to mesh
   */
  private smoothMesh(mesh: FaceMesh, iterations: number): void {
    for (let iter = 0; iter < iterations; iter++) {
      const newVertices = [...mesh.vertices];

      // Build adjacency list
      const adjacency: number[][] = new Array(mesh.vertices.length).fill(null).map(() => []);
      
      for (const triangle of mesh.triangles) {
        const [i, j, k] = triangle.vertices;
        adjacency[i].push(j, k);
        adjacency[j].push(i, k);
        adjacency[k].push(i, j);
      }

      // Apply Laplacian smoothing
      for (let i = 0; i < mesh.vertices.length; i++) {
        const neighbors = [...new Set(adjacency[i])]; // Remove duplicates
        
        if (neighbors.length > 0) {
          let avgX = 0, avgY = 0, avgZ = 0;
          
          for (const neighborIndex of neighbors) {
            const neighbor = mesh.vertices[neighborIndex];
            avgX += neighbor.x;
            avgY += neighbor.y;
            avgZ += neighbor.z;
          }
          
          avgX /= neighbors.length;
          avgY /= neighbors.length;
          avgZ /= neighbors.length;
          
          // Blend with original position (0.5 smoothing factor)
          const smoothingFactor = 0.5;
          newVertices[i] = {
            x: mesh.vertices[i].x * (1 - smoothingFactor) + avgX * smoothingFactor,
            y: mesh.vertices[i].y * (1 - smoothingFactor) + avgY * smoothingFactor,
            z: mesh.vertices[i].z * (1 - smoothingFactor) + avgZ * smoothingFactor,
          };
        }
      }

      mesh.vertices = newVertices;
    }

    // Recalculate normals after smoothing
    if (mesh.normalMap.length > 0) {
      mesh.normalMap = this.calculateNormals(mesh.vertices, mesh.triangles);
    }
  }

  /**
   * Remove redundant vertices from mesh
   */
  private removeRedundantVertices(mesh: OptimizedMesh): void {
    const threshold = 0.001; // Distance threshold for considering vertices identical
    const vertexMap = new Map<string, number>();
    const newVertices: Vector3[] = [];
    const vertexMapping: number[] = [];

    // Find unique vertices
    for (let i = 0; i < mesh.vertices.length; i++) {
      const vertex = mesh.vertices[i];
      const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
      
      if (vertexMap.has(key)) {
        vertexMapping[i] = vertexMap.get(key)!;
      } else {
        const newIndex = newVertices.length;
        newVertices.push(vertex);
        vertexMap.set(key, newIndex);
        vertexMapping[i] = newIndex;
      }
    }

    // Update triangles with new vertex indices
    for (const triangle of mesh.triangles) {
      triangle.vertices = [
        vertexMapping[triangle.vertices[0]],
        vertexMapping[triangle.vertices[1]],
        vertexMapping[triangle.vertices[2]],
      ];
    }

    // Update UV mapping and normals
    if (mesh.uvMapping.length > 0) {
      const newUVMapping: UVCoordinate[] = [];
      for (let i = 0; i < newVertices.length; i++) {
        const originalIndex = vertexMapping.indexOf(i);
        if (originalIndex !== -1) {
          newUVMapping.push(mesh.uvMapping[originalIndex]);
        }
      }
      mesh.uvMapping = newUVMapping;
    }

    if (mesh.normalMap.length > 0) {
      const newNormals: NormalVector[] = [];
      for (let i = 0; i < newVertices.length; i++) {
        const originalIndex = vertexMapping.indexOf(i);
        if (originalIndex !== -1) {
          newNormals.push(mesh.normalMap[originalIndex]);
        }
      }
      mesh.normalMap = newNormals;
    }

    mesh.vertices = newVertices;
    mesh.boundingBox = this.calculateBoundingBox(newVertices);
  }

  /**
   * Optimize triangle distribution
   */
  private optimizeTriangulation(mesh: OptimizedMesh): void {
    // Remove degenerate triangles
    const validTriangles = mesh.triangles.filter(triangle => {
      const [i, j, k] = triangle.vertices;
      const v1 = mesh.vertices[i];
      const v2 = mesh.vertices[j];
      const v3 = mesh.vertices[k];
      
      return this.isValidTriangle(v1, v2, v3);
    });

    mesh.triangles = validTriangles;
  }

  /**
   * Improve triangle aspect ratios
   */
  private improveAspectRatios(mesh: OptimizedMesh): void {
    // This is a simplified version - production would use edge flipping algorithms
    const improvedTriangles: Triangle[] = [];

    for (const triangle of mesh.triangles) {
      const aspectRatio = this.calculateTriangleAspectRatio(triangle, mesh.vertices);
      
      // Only keep triangles with reasonable aspect ratios
      if (aspectRatio > 0.2) {
        improvedTriangles.push(triangle);
      }
    }

    mesh.triangles = improvedTriangles;
  }

  /**
   * Calculate triangle aspect ratio
   */
  private calculateTriangleAspectRatio(triangle: Triangle, vertices: Vector3[]): number {
    const [i, j, k] = triangle.vertices;
    
    // Validate indices
    if (i >= vertices.length || j >= vertices.length || k >= vertices.length) {
      return 0;
    }
    
    const v1 = vertices[i];
    const v2 = vertices[j];
    const v3 = vertices[k];

    const a = this.distance3D(v1, v2);
    const b = this.distance3D(v2, v3);
    const c = this.distance3D(v3, v1);

    // Check for degenerate triangle
    if (a < 0.001 || b < 0.001 || c < 0.001) {
      return 0;
    }

    const s = (a + b + c) / 2; // Semi-perimeter
    
    // Check if triangle is valid for Heron's formula
    const discriminant = s * (s - a) * (s - b) * (s - c);
    if (discriminant <= 0) {
      return 0;
    }
    
    const area = Math.sqrt(discriminant); // Heron's formula
    const longestEdge = Math.max(a, b, c);
    
    if (longestEdge === 0 || area === 0) {
      return 0;
    }
    
    const ratio = (4 * Math.sqrt(3) * area) / (longestEdge * longestEdge);
    return isNaN(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  }

  /**
   * Find degenerate triangles
   */
  private findDegenerateTriangles(mesh: FaceMesh): number[] {
    const degenerateIndices: number[] = [];

    for (let i = 0; i < mesh.triangles.length; i++) {
      const triangle = mesh.triangles[i];
      const [vi, vj, vk] = triangle.vertices;
      const v1 = mesh.vertices[vi];
      const v2 = mesh.vertices[vj];
      const v3 = mesh.vertices[vk];

      if (!this.isValidTriangle(v1, v2, v3)) {
        degenerateIndices.push(i);
      }
    }

    return degenerateIndices;
  }

  /**
   * Calculate comprehensive quality metrics
   */
  private async calculateQualityMetrics(mesh: FaceMesh): Promise<MeshQualityMetrics> {
    const vertexCount = mesh.vertices.length;
    const triangleCount = mesh.triangles.length;

    // Calculate average aspect ratio
    let totalAspectRatio = 0;
    let validTriangles = 0;
    for (const triangle of mesh.triangles) {
      const ratio = this.calculateTriangleAspectRatio(triangle, mesh.vertices);
      if (!isNaN(ratio) && isFinite(ratio)) {
        totalAspectRatio += ratio;
        validTriangles++;
      }
    }
    const aspectRatio = validTriangles > 0 ? totalAspectRatio / validTriangles : 0.5;

    // Calculate symmetry score (simplified)
    const symmetryScore = this.calculateSymmetryScore(mesh);

    // Calculate smoothness score
    const smoothnessScore = this.calculateSmoothnessScore(mesh);

    // Calculate topology score
    const topologyScore = this.calculateTopologyScore(mesh);

    // Ensure all scores are valid numbers
    const validAspectRatio = isNaN(aspectRatio) ? 0.5 : Math.max(0, Math.min(1, aspectRatio));
    const validSymmetryScore = isNaN(symmetryScore) ? 0.5 : Math.max(0, Math.min(1, symmetryScore));
    const validSmoothnessScore = isNaN(smoothnessScore) ? 0.5 : Math.max(0, Math.min(1, smoothnessScore));
    const validTopologyScore = isNaN(topologyScore) ? 0.5 : Math.max(0, Math.min(1, topologyScore));

    // Overall quality is weighted average
    const overallQuality = (
      validAspectRatio * 0.3 +
      validSymmetryScore * 0.25 +
      validSmoothnessScore * 0.25 +
      validTopologyScore * 0.2
    );

    return {
      vertexCount,
      triangleCount,
      aspectRatio: validAspectRatio,
      symmetryScore: validSymmetryScore,
      smoothnessScore: validSmoothnessScore,
      topologyScore: validTopologyScore,
      overallQuality: Math.max(0, Math.min(1, overallQuality)),
    };
  }

  /**
   * Calculate mesh symmetry score
   */
  private calculateSymmetryScore(mesh: FaceMesh): number {
    // Simplified symmetry calculation
    // Check if vertices on left side have corresponding vertices on right side
    let symmetricPairs = 0;
    let totalVertices = 0;

    const centerX = (mesh.boundingBox.min.x + mesh.boundingBox.max.x) / 2;
    const tolerance = 0.05;

    for (const vertex of mesh.vertices) {
      if (Math.abs(vertex.x - centerX) > tolerance) {
        totalVertices++;
        
        // Look for symmetric counterpart
        const mirrorX = centerX + (centerX - vertex.x);
        const hasSymmetricPair = mesh.vertices.some(v => 
          Math.abs(v.x - mirrorX) < tolerance &&
          Math.abs(v.y - vertex.y) < tolerance &&
          Math.abs(v.z - vertex.z) < tolerance
        );
        
        if (hasSymmetricPair) {
          symmetricPairs++;
        }
      }
    }

    return totalVertices > 0 ? symmetricPairs / totalVertices : 1;
  }

  /**
   * Calculate mesh smoothness score
   */
  private calculateSmoothnessScore(mesh: FaceMesh): number {
    if (mesh.normalMap.length === 0) {
      return 0.5; // Default score if no normals
    }

    // Build adjacency list
    const adjacency: number[][] = new Array(mesh.vertices.length).fill(null).map(() => []);
    
    for (const triangle of mesh.triangles) {
      const [i, j, k] = triangle.vertices;
      adjacency[i].push(j, k);
      adjacency[j].push(i, k);
      adjacency[k].push(i, j);
    }

    let totalSmoothness = 0;
    let validVertices = 0;

    // Calculate normal variation for each vertex
    for (let i = 0; i < mesh.vertices.length; i++) {
      const neighbors = [...new Set(adjacency[i])];
      
      if (neighbors.length > 0) {
        const currentNormal = mesh.normalMap[i];
        let normalVariation = 0;
        
        for (const neighborIndex of neighbors) {
          const neighborNormal = mesh.normalMap[neighborIndex];
          const dotProduct = 
            currentNormal.x * neighborNormal.x +
            currentNormal.y * neighborNormal.y +
            currentNormal.z * neighborNormal.z;
          
          // Convert dot product to angle (0 = same direction, 1 = opposite)
          const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct))) / Math.PI;
          normalVariation += angle;
        }
        
        normalVariation /= neighbors.length;
        totalSmoothness += 1 - normalVariation; // Higher score for less variation
        validVertices++;
      }
    }

    return validVertices > 0 ? totalSmoothness / validVertices : 0.5;
  }

  /**
   * Calculate topology score
   */
  private calculateTopologyScore(mesh: FaceMesh): number {
    // Check for good topology characteristics
    let score = 1.0;

    // Penalize for degenerate triangles
    const degenerateCount = this.findDegenerateTriangles(mesh).length;
    const degeneratePenalty = degenerateCount / mesh.triangles.length;
    score -= degeneratePenalty * 0.5;

    // Reward for reasonable vertex-to-triangle ratio
    const vertexTriangleRatio = mesh.vertices.length / Math.max(1, mesh.triangles.length);
    const idealRatio = 0.5; // Approximately 2 triangles per vertex
    const ratioScore = 1 - Math.abs(vertexTriangleRatio - idealRatio) / idealRatio;
    score *= ratioScore;

    return Math.max(0, Math.min(1, score));
  }
}

export const faceMeshGenerator = new FaceMeshGenerator();